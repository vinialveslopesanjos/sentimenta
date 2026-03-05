"""
Apify service for Instagram data enrichment.

Uses apify~instagram-scraper actor for post metadata (likes, views, thumbnails, timestamps).
Does NOT fetch comments via Apify (too expensive — use XPoz for that).
"""

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

APIFY_BASE_URL = "https://api.apify.com/v2"
SCRAPER_ACTOR = "apify~instagram-scraper"

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


def fetch_post_thumbnail_apify(shortcode: str) -> Optional[str]:
    """Fetch a single post's thumbnail via Apify."""
    token = _get_token()
    if not token:
        logger.warning("APIFY_API_TOKEN not configured")
        return None

    try:
        run_url = f"{APIFY_BASE_URL}/acts/{SCRAPER_ACTOR}/run-sync-get-dataset-items"
        payload = {
            "directUrls": [f"https://www.instagram.com/p/{shortcode}/"],
            "resultsLimit": 1,
            "resultsType": "posts",
        }
        with httpx.Client(timeout=120) as client:
            resp = client.post(run_url, params={"token": token}, json=payload)
            resp.raise_for_status()
            items = resp.json()

        if items and len(items) > 0:
            url = items[0].get("displayUrl") or items[0].get("thumbnailUrl")
            if url:
                return url

        return None
    except Exception as exc:
        logger.error("Apify thumbnail fetch failed for %s: %s", shortcode, exc)
        return None


BATCH_SIZE = 10  # Conservative batch size to avoid 400 errors


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
    run_url = f"{APIFY_BASE_URL}/acts/{SCRAPER_ACTOR}/run-sync-get-dataset-items"
    payload = {
        "directUrls": [f"https://www.instagram.com/p/{sc}/" for sc in shortcodes],
        "resultsLimit": len(shortcodes),
        "resultsType": "posts",
    }
    try:
        with httpx.Client(timeout=600) as client:
            resp = client.post(run_url, params={"token": token}, json=payload)
            resp.raise_for_status()
            items = resp.json()

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

    result: dict[str, dict] = {}
    total_batches = (len(shortcodes) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(shortcodes), BATCH_SIZE):
        batch = shortcodes[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        logger.info("Apify: batch %d/%d (%d shortcodes)", batch_num, total_batches, len(batch))
        try:
            batch_result = _enrich_batch(batch, token)
            result.update(batch_result)
        except Exception as exc:
            logger.error("Apify batch %d/%d failed: %s", batch_num, total_batches, exc)

    logger.info("Apify enrichment: got data for %d/%d posts", len(result), len(shortcodes))
    return result
