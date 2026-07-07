"""
Apify service for Instagram data enrichment.

Uses apify~instagram-scraper actor for post metadata (likes, views, thumbnails, timestamps).
Optionally uses a comment-specific actor for full comment data (dates, likes, profile pics).
"""

import logging
import math
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import httpx

from app.core.config import settings
from app.core.apify_cost_tracker import is_limit_reached, add_cost, fetch_last_run_cost, get_daily_spend

logger = logging.getLogger(__name__)


# ── Custom exceptions ─────────────────────────────────────────────────
class ApifyError(Exception):
    """Base error for Apify operations."""
    pass


class ApifyRateLimitError(ApifyError):
    """Apify daily spending limit reached."""
    pass


class ApifyFetchError(ApifyError):
    """Failed to fetch data from Apify."""
    pass


APIFY_BASE_URL = "https://api.apify.com/v2"
SCRAPER_ACTOR = "apify~instagram-scraper"

# ── Comment scraping via Apify ──────────────────────────────────────────
COMMENT_ACTOR = os.getenv("APIFY_COMMENT_ACTOR", "apidojo~instagram-comments-scraper")
COMMENT_TIMEOUT = 600     # 10 min per run
COMMENT_WORKERS = 10      # parallel workers
COMMENT_MAX_RETRIES = 3   # retry attempts for 429/5xx

# ── Hard safety caps (aprendizado da run de US$40,16 em 2026-07-01) ─────
# Teto ABSOLUTO de comentários por post, aplicado independente de plano ou
# input do usuário — o daily_sync do plano admin passou 999999 como maxItems
# num actor pay-per-result e um único post viral custou US$40.
HARD_MAX_COMMENTS_PER_POST = int(os.getenv("APIFY_HARD_MAX_COMMENTS_PER_POST", "2000"))
# Teto de cobrança por run enviado à API (defesa extra para actors
# pay-per-result/pay-per-event; a API ignora quando não se aplica).
MAX_CHARGE_PER_RUN_USD = os.getenv("APIFY_MAX_CHARGE_PER_RUN_USD", "2")


def _run_params(token: str) -> dict:
    return {"token": token, "maxTotalChargeUsd": MAX_CHARGE_PER_RUN_USD}

# Map Apify type field to our post_type
_TYPE_MAP = {
    "GraphImage": "image",
    "GraphVideo": "video",
    "GraphSidecar": "carousel",
    "Image": "image",
    "Video": "video",
    "Sidecar": "carousel",
}


def _get_token() -> str:
    return settings.APIFY_API_TOKEN


def _record_run_cost(actor_id: str) -> float:
    """Fetch and record the cost of the last Apify run for the given actor."""
    try:
        cost = fetch_last_run_cost(actor_id)
        if cost > 0:
            total = add_cost(cost)
            logger.info("Apify cost: $%.4f this run, $%.4f today", cost, total)
        return cost
    except Exception as exc:
        logger.debug("Failed to record Apify run cost: %s", exc)
        return 0.0


def fetch_profile_apify(username: str) -> Optional[dict]:
    """Fetch full Instagram profile data via Apify scraper.

    Returns dict with: id, username, fullName, biography, followersCount,
    followsCount, postsCount, private, verified, profilePicUrl, profilePicUrlHD
    """
    token = _get_token()
    if not token:
        logger.warning("APIFY_API_TOKEN not configured")
        return None

    if is_limit_reached():
        return None

    try:
        run_url = f"{APIFY_BASE_URL}/acts/{SCRAPER_ACTOR}/run-sync-get-dataset-items"
        payload = {
            "directUrls": [f"https://www.instagram.com/{username}/"],
            "resultsLimit": 1,
            "resultsType": "details",
        }
        with httpx.Client(timeout=120) as client:
            resp = client.post(run_url, params=_run_params(token), json=payload)
            resp.raise_for_status()
            items = resp.json()

        _record_run_cost(SCRAPER_ACTOR)

        if items and len(items) > 0:
            return items[0]
        return None
    except Exception as exc:
        logger.error("Apify profile fetch failed for @%s: %s", username, exc)
        return None


def fetch_profile_pic_apify(username: str) -> Optional[str]:
    """Fetch Instagram profile picture URL via Apify scraper.

    Uses the instagram-scraper actor with resultsType=profile to get
    a direct CDN URL for the profile picture (HD when available).
    """
    token = _get_token()
    if not token:
        logger.warning("APIFY_API_TOKEN not configured")
        return None

    if is_limit_reached():
        return None

    try:
        run_url = f"{APIFY_BASE_URL}/acts/{SCRAPER_ACTOR}/run-sync-get-dataset-items"
        payload = {
            "directUrls": [f"https://www.instagram.com/{username}/"],
            "resultsLimit": 1,
            "resultsType": "details",
        }
        with httpx.Client(timeout=120) as client:
            resp = client.post(run_url, params=_run_params(token), json=payload)
            resp.raise_for_status()
            items = resp.json()

        _record_run_cost(SCRAPER_ACTOR)

        if items and len(items) > 0:
            item = items[0]
            url = (
                item.get("profilePicUrlHD")
                or item.get("profilePicUrl")
                or item.get("profilePicture")
            )
            if url:
                return url

        return None
    except Exception as exc:
        logger.error("Apify profile pic fetch failed for @%s: %s", username, exc)
        return None


def fetch_post_thumbnail_apify(shortcode: str) -> Optional[str]:
    """Fetch a single post's thumbnail via Apify."""
    token = _get_token()
    if not token:
        logger.warning("APIFY_API_TOKEN not configured")
        return None

    if is_limit_reached():
        return None

    try:
        run_url = f"{APIFY_BASE_URL}/acts/{SCRAPER_ACTOR}/run-sync-get-dataset-items"
        payload = {
            "directUrls": [f"https://www.instagram.com/p/{shortcode}/"],
            "resultsLimit": 1,
            "resultsType": "posts",
        }
        with httpx.Client(timeout=120) as client:
            resp = client.post(run_url, params=_run_params(token), json=payload)
            resp.raise_for_status()
            items = resp.json()

        _record_run_cost(SCRAPER_ACTOR)

        if items and len(items) > 0:
            url = items[0].get("displayUrl") or items[0].get("thumbnailUrl")
            if url:
                return url

        return None
    except Exception as exc:
        logger.error("Apify thumbnail fetch failed for %s: %s", shortcode, exc)
        return None


BATCH_SIZE = 10  # Conservative batch size to avoid 400 errors


def fetch_posts_apify(
    username: str,
    max_posts: int = 10,
    step_callback=None,
) -> list[dict]:
    """Fetch recent posts for a profile via Apify Instagram Scraper.

    Returns a list of dicts compatible with the ingest pipeline:
      platform_post_id, caption, like_count, comment_count, view_count,
      post_type, permalink, timestamp, media_url
    """
    token = _get_token()
    _step = step_callback or (lambda msg: None)
    if not token:
        logger.warning("APIFY_API_TOKEN not configured")
        return []

    if is_limit_reached():
        limit = settings.APIFY_DAILY_LIMIT_USD
        spent = get_daily_spend()
        msg = f"Apify daily limit reached (${spent:.2f}/${limit:.2f}), skipping scraping"
        _step(msg)
        raise ApifyRateLimitError(msg)

    try:
        run_url = f"{APIFY_BASE_URL}/acts/{SCRAPER_ACTOR}/run-sync-get-dataset-items"
        payload = {
            "directUrls": [f"https://www.instagram.com/{username}/"],
            "resultsLimit": max_posts,
            "resultsType": "posts",
        }
        with httpx.Client(timeout=300) as client:
            resp = client.post(run_url, params=_run_params(token), json=payload)
            resp.raise_for_status()
            items = resp.json()

        _record_run_cost(SCRAPER_ACTOR)

        if not items:
            _step("Apify: nenhum post encontrado")
            return []

        results = []
        for item in items:
            sc = item.get("shortCode") or item.get("shortcode")
            if not sc:
                continue
            post_url = item.get("url") or f"https://www.instagram.com/p/{sc}/"
            display_url = item.get("displayUrl") or item.get("thumbnailUrl")
            results.append({
                "platform_post_id": sc,
                "caption": item.get("caption", ""),
                "like_count": item.get("likesCount", 0) or 0,
                "comment_count": item.get("commentsCount", 0) or 0,
                "view_count": item.get("videoViewCount", 0) or item.get("videoPlayCount", 0) or 0,
                "share_count": 0,
                "post_type": _TYPE_MAP.get(item.get("type"), item.get("type")),
                "permalink": post_url,
                "timestamp": item.get("timestamp"),
                "media_url": display_url,
            })

        _step(f"Apify: {len(results)} posts obtidos")
        logger.info("Apify posts: fetched %d posts for @%s", len(results), username)
        return results
    except ApifyError:
        raise
    except Exception as exc:
        logger.error("Apify posts fetch failed for @%s: %s", username, exc)
        _step(f"Apify posts: erro — {exc}")
        raise ApifyFetchError(f"Failed to fetch posts for @{username}: {exc}") from exc


def _parse_apify_item(item: dict) -> Optional[dict]:
    """Parse a single Apify response item."""
    sc = item.get("shortCode") or item.get("shortcode")
    if not sc:
        return None
    return {
        "shortcode": sc,
        "like_count": item.get("likesCount", 0) or 0,
        "comment_count": item.get("commentsCount", 0) or 0,
        "view_count": item.get("videoViewCount", 0) or item.get("videoPlayCount", 0) or 0,
        "display_url": item.get("displayUrl") or item.get("thumbnailUrl"),
        "post_type": _TYPE_MAP.get(item.get("type"), item.get("type")),
        "timestamp": item.get("timestamp"),
    }


def _enrich_batch(shortcodes: list[str], token: str) -> dict[str, dict]:
    """Single Apify run for a batch of shortcodes. Falls back to 1-by-1 on failure."""
    if is_limit_reached():
        raise ApifyRateLimitError("Apify daily limit reached during enrichment batch")

    run_url = f"{APIFY_BASE_URL}/acts/{SCRAPER_ACTOR}/run-sync-get-dataset-items"
    payload = {
        "directUrls": [f"https://www.instagram.com/p/{sc}/" for sc in shortcodes],
        "resultsLimit": len(shortcodes),
        "resultsType": "posts",
    }
    try:
        with httpx.Client(timeout=600) as client:
            resp = client.post(run_url, params=_run_params(token), json=payload)
            resp.raise_for_status()
            items = resp.json()

        _record_run_cost(SCRAPER_ACTOR)

        result: dict[str, dict] = {}
        for item in (items or []):
            parsed = _parse_apify_item(item)
            if parsed:
                result[parsed.pop("shortcode")] = parsed
        return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 400 and len(shortcodes) > 1:
            # Batch failed — try one by one to find which posts are problematic
            logger.warning("Apify batch of %d failed with 400, retrying 1-by-1", len(shortcodes))
            result: dict[str, dict] = {}
            for sc in shortcodes:
                if is_limit_reached():
                    break
                try:
                    single_payload = {
                        "directUrls": [f"https://www.instagram.com/p/{sc}/"],
                        "resultsLimit": 1,
                        "resultsType": "posts",
                    }
                    with httpx.Client(timeout=120) as client:
                        resp = client.post(run_url, params={"token": token}, json=single_payload)
                        resp.raise_for_status()
                        items = resp.json()
                    _record_run_cost(SCRAPER_ACTOR)
                    for item in (items or []):
                        parsed = _parse_apify_item(item)
                        if parsed:
                            result[parsed.pop("shortcode")] = parsed
                except Exception as single_exc:
                    logger.debug("Apify single fetch failed for %s: %s", sc, single_exc)
            return result
        raise


def enrich_posts_apify(shortcodes: list[str]) -> dict[str, dict]:
    """Fetch full post metadata for shortcodes via Apify, in batches of 20.

    Returns dict mapping shortcode -> {like_count, comment_count, view_count, display_url, post_type, timestamp}.
    """
    token = _get_token()
    if not token:
        logger.warning("APIFY_API_TOKEN not configured, skipping enrichment")
        return {}

    if not shortcodes:
        return {}

    if is_limit_reached():
        logger.warning("Apify daily limit reached, skipping enrichment")
        raise ApifyRateLimitError("Apify daily limit reached, skipping enrichment")

    result: dict[str, dict] = {}
    total_batches = (len(shortcodes) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(shortcodes), BATCH_SIZE):
        batch = shortcodes[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        logger.info("Apify: batch %d/%d (%d shortcodes)", batch_num, total_batches, len(batch))
        try:
            batch_result = _enrich_batch(batch, token)
            result.update(batch_result)
        except ApifyRateLimitError:
            logger.warning("Apify daily limit reached at batch %d/%d", batch_num, total_batches)
            break
        except Exception as exc:
            logger.error("Apify batch %d/%d failed: %s", batch_num, total_batches, exc)
            raise ApifyFetchError(f"Apify enrichment batch {batch_num}/{total_batches} failed: {exc}") from exc

    logger.info("Apify enrichment: got data for %d/%d posts", len(result), len(shortcodes))
    return result


# ── Comment scraping functions ──────────────────────────────────────────

_Z_SCORES = {0.80: 1.28, 0.90: 1.645, 0.95: 1.96}


def _calc_sample_size(population: int, confidence: float = 0.80, margin: float = 0.05) -> int:
    """Calculate statistically representative sample size with finite population correction."""
    if population <= 0:
        return 0
    z = _Z_SCORES.get(confidence, 1.28)
    n = (z ** 2 * 0.25) / (margin ** 2)
    n_adj = n / (1 + (n - 1) / population)
    return min(math.ceil(n_adj), population)


def _parse_apify_comment(item: dict) -> Optional[dict]:
    """Parse a single Apify comment item.

    Supports multiple actor field formats:
      - API Dojo actor: message, user.username, createdAt, likeCount, user.profilePicUrl
      - Official/legacy: text, ownerUsername, timestamp, likesCount, profilePicUrl
    """
    user_obj = item.get("user") or {}
    text = item.get("text") or item.get("message") or item.get("comment", "")
    if not text or not str(text).strip():
        return None
    return {
        "platform_comment_id": str(
            item.get("id") or item.get("comment_id") or item.get("pk") or ""
        ),
        "text": str(text).strip(),
        "username": (
            item.get("ownerUsername")
            or user_obj.get("username")
            or item.get("username", "")
        ),
        "timestamp": item.get("createdAt") or item.get("timestamp") or item.get("reply_date"),
        "like_count": item.get("likeCount") or item.get("likesCount") or item.get("likes_number", 0) or 0,
        "profile_pic_url": (
            item.get("profilePicUrl")
            or user_obj.get("profilePicUrl")
            or item.get("profile_pic_url")
        ),
    }


def _fetch_comments_for_post(post_url: str, max_items: int, token: str) -> list[dict]:
    """Fetch comments for a SINGLE post via Apify with retry for 429/5xx.

    One post per run eliminates URL-matching ambiguity and ensures maxItems
    applies exclusively to this post's comments.
    """
    if is_limit_reached():
        return []

    max_items = max(1, min(int(max_items), HARD_MAX_COMMENTS_PER_POST))
    run_url = f"{APIFY_BASE_URL}/acts/{COMMENT_ACTOR}/run-sync-get-dataset-items"
    payload = {"startUrls": [post_url], "maxItems": max_items}

    for attempt in range(COMMENT_MAX_RETRIES):
        try:
            with httpx.Client(timeout=COMMENT_TIMEOUT) as client:
                resp = client.post(run_url, params=_run_params(token), json=payload)
                resp.raise_for_status()
                items = resp.json()
            _record_run_cost(COMMENT_ACTOR)
            return [c for c in (_parse_apify_comment(item) for item in (items or [])) if c]
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (429, 500, 502, 503) and attempt < COMMENT_MAX_RETRIES - 1:
                wait = 5 * (attempt + 1)
                logger.warning(
                    "Apify comment fetch retry %d/%d for %s: HTTP %d (wait %ds)",
                    attempt + 1, COMMENT_MAX_RETRIES - 1, post_url, e.response.status_code, wait,
                )
                time.sleep(wait)
                continue
            raise


def _apply_smart_sample(
    comments: list[dict],
    population: int,
    reserve_top_pct: float = 0.10,
) -> list[dict]:
    """Sample comments preserving top-liked ones.

    Reserves `reserve_top_pct` of the sample for the highest-liked comments,
    fills the rest randomly from the remaining pool.
    """
    import random

    sample_size = _calc_sample_size(population)
    if len(comments) <= sample_size:
        return comments

    top_count = max(1, math.ceil(sample_size * reserve_top_pct))
    remaining_count = max(0, sample_size - top_count)

    sorted_by_likes = sorted(
        comments, key=lambda c: c.get("like_count", 0) or 0, reverse=True
    )
    top_comments = sorted_by_likes[:top_count]
    rest_pool = sorted_by_likes[top_count:]

    sampled_rest = random.sample(rest_pool, min(remaining_count, len(rest_pool)))

    return top_comments + sampled_rest


def fetch_comments_apify(
    post_urls: list[str],
    max_per_post: int = 10000,
    per_post_limits: Optional[dict[str, int]] = None,
    sample_mode: str = "all",
    comment_counts: Optional[dict[str, int]] = None,
    step_callback=None,
) -> dict[str, list[dict]]:
    """Fetch comments for multiple posts via Apify comment actor.

    Each post runs as an individual Apify run (1 post = 1 run) to ensure
    maxItems applies per-post and eliminate URL-matching ambiguity.
    Workers process posts in parallel for speed.

    Args:
        post_urls: List of Instagram post URLs
        max_per_post: Max comments per post (for "all" mode)
        sample_mode: "all" or "sample" (statistical sampling at 80% confidence)
        comment_counts: {url: estimated_comment_count} for sampling calculation
        step_callback: Progress callback (thread-safe)

    Returns:
        {post_url: [comment_dict, ...]}
    """
    token = _get_token()
    if not token:
        logger.warning("APIFY_API_TOKEN not configured, skipping comment fetch")
        return {}

    if not post_urls:
        return {}

    if is_limit_reached():
        limit = settings.APIFY_DAILY_LIMIT_USD
        spent = get_daily_spend()
        msg = f"Apify daily limit reached (${spent:.2f}/${limit:.2f}), skipping comment scraping"
        logger.warning(msg)
        raise ApifyRateLimitError(msg)

    # IMPORTANT: step_callback may commit on a SQLAlchemy session that is NOT
    # thread-safe.  We must only call it from the caller's thread (after all
    # worker threads have finished).  Inside the ThreadPoolExecutor we use
    # logger-only progress and collect messages for the caller.
    _step = step_callback or (lambda msg: None)
    _lock = threading.Lock()
    comment_counts = comment_counts or {}

    # Calculate limits per URL
    limits: dict[str, int] = {}
    for url in post_urls:
        if per_post_limits and url in per_post_limits:
            limits[url] = per_post_limits[url]
        elif sample_mode == "sample" and url in comment_counts and comment_counts[url] > 0:
            limits[url] = _calc_sample_size(comment_counts[url])
        else:
            limits[url] = max_per_post
        limits[url] = max(1, min(limits[url], HARD_MAX_COMMENTS_PER_POST))

    total_posts = len(post_urls)
    _step(f"Apify Comments: {total_posts} posts ({COMMENT_WORKERS} workers, 1 post/run)")

    result: dict[str, list[dict]] = {}
    done_count = 0

    def _process_post(url: str) -> tuple[str, list[dict]]:
        nonlocal done_count
        limit = limits.get(url, max_per_post)
        try:
            comments = _fetch_comments_for_post(url, limit, token)
            with _lock:
                done_count += 1
                logger.info("Apify Comments: %d/%d posts (%d comentários)", done_count, total_posts, len(comments))
            return (url, comments)
        except Exception as exc:
            with _lock:
                done_count += 1
                logger.error("Apify Comments: %d/%d posts (erro: %s)", done_count, total_posts, exc)
            return (url, [])

    with ThreadPoolExecutor(max_workers=COMMENT_WORKERS) as executor:
        futures = {executor.submit(_process_post, url): url for url in post_urls}
        for future in as_completed(futures):
            url, comments = future.result()
            result[url] = comments

    total_fetched = sum(len(v) for v in result.values())
    # Safe to call step_callback here — we're back on the caller's thread
    _step(f"Apify Comments: {total_fetched} comentários obtidos de {total_posts} posts")
    logger.info("Apify comments: fetched %d comments for %d posts", total_fetched, total_posts)
    return result
