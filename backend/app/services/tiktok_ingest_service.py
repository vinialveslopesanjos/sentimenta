"""
TikTok data ingestion service via Apify Clockworks actors.

Actors used:
  - clockworks/tiktok-scraper          → fetch posts from a profile
  - clockworks/tiktok-comments-scraper → fetch comments for a post
  - clockworks/tiktok-profile-scraper  → fetch commenter profiles (demographics)

This module does NOT touch OAuth (that lives in tiktok_service.py).
"""

import hashlib
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.apify_cost_tracker import is_limit_reached, add_cost
from app.models.post import Post
from app.models.comment import Comment
from app.models.social_connection import SocialConnection

logger = logging.getLogger(__name__)

# ── Apify config ─────────────────────────────────────────────────────────
APIFY_BASE_URL = "https://api.apify.com/v2"

ACTOR_TIKTOK_POSTS = "clockworks~tiktok-scraper"
ACTOR_TIKTOK_COMMENTS = "clockworks~tiktok-comments-scraper"
ACTOR_TIKTOK_PROFILES = "clockworks~tiktok-profile-scraper"

POLL_INTERVAL = 5  # seconds between status polls
DEFAULT_TIMEOUT = 300  # 5 min


# ── Helpers ──────────────────────────────────────────────────────────────

def _clean_text(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.strip())


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _safe_int(val) -> int:
    try:
        return int(str(val).replace(",", "").strip())
    except Exception:
        return 0


def _parse_timestamp(value) -> Optional[datetime]:
    """Parse TikTok timestamps: ISO string or unix epoch."""
    if not value:
        return None
    raw = str(value).strip()
    if raw.lower() in ("null", "none", ""):
        return None

    # Try ISO format first (createTimeISO)
    try:
        normalized = raw.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except (ValueError, TypeError):
        pass

    # Try unix timestamp (createTime)
    try:
        ts = float(raw)
        if ts > 1e12:
            ts = ts / 1000  # milliseconds to seconds
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    except (ValueError, TypeError):
        pass

    return None


# ── Apify actor runner ───────────────────────────────────────────────────

def _run_apify_actor(
    actor_id: str,
    input_data: dict,
    timeout: int = DEFAULT_TIMEOUT,
) -> list[dict]:
    """Start an Apify actor run, poll until complete, return dataset items.

    Checks daily cost limit before starting. Records cost after completion.
    """
    token = settings.APIFY_API_TOKEN
    if not token:
        logger.error("TikTok ingest: APIFY_API_TOKEN not configured")
        return []

    if is_limit_reached():
        logger.warning("TikTok ingest: Apify daily cost limit reached, skipping actor %s", actor_id)
        return []

    # Start run
    try:
        resp = httpx.post(
            f"{APIFY_BASE_URL}/acts/{actor_id}/runs",
            params={"token": token},
            json=input_data,
            timeout=30,
        )
        resp.raise_for_status()
        run_data = resp.json().get("data", {})
        run_id = run_data.get("id")
        if not run_id:
            logger.error("TikTok ingest: Apify returned no run ID for actor %s", actor_id)
            return []
    except Exception as exc:
        logger.error("TikTok ingest: Failed to start Apify actor %s: %s", actor_id, exc)
        return []

    logger.info("TikTok ingest: Started Apify run %s for actor %s", run_id, actor_id)

    # Poll for completion
    deadline = time.time() + timeout
    status = "RUNNING"
    while time.time() < deadline:
        time.sleep(POLL_INTERVAL)
        try:
            status_resp = httpx.get(
                f"{APIFY_BASE_URL}/actor-runs/{run_id}",
                params={"token": token},
                timeout=15,
            )
            status_resp.raise_for_status()
            run_info = status_resp.json().get("data", {})
            status = run_info.get("status", "RUNNING")
            if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
                break
        except Exception as exc:
            logger.warning("TikTok ingest: Error polling run %s: %s", run_id, exc)

    if status != "SUCCEEDED":
        logger.error("TikTok ingest: Apify run %s ended with status %s", run_id, status)
        return []

    # Record cost
    try:
        cost_resp = httpx.get(
            f"{APIFY_BASE_URL}/actor-runs/{run_id}",
            params={"token": token},
            timeout=15,
        )
        cost_resp.raise_for_status()
        cost_usd = cost_resp.json().get("data", {}).get("usageTotalUsd", 0.0)
        if cost_usd and cost_usd > 0:
            total = add_cost(float(cost_usd))
            logger.info("TikTok ingest: Apify cost $%.4f this run, $%.4f today total", cost_usd, total)
    except Exception as exc:
        logger.debug("TikTok ingest: Failed to record run cost: %s", exc)

    # Get dataset items
    try:
        items_resp = httpx.get(
            f"{APIFY_BASE_URL}/actor-runs/{run_id}/dataset/items",
            params={"token": token},
            timeout=60,
        )
        items_resp.raise_for_status()
        items = items_resp.json()
        if not isinstance(items, list):
            items = []
        logger.info("TikTok ingest: Got %d items from run %s", len(items), run_id)
        return items
    except Exception as exc:
        logger.error("TikTok ingest: Failed to fetch dataset items for run %s: %s", run_id, exc)
        return []


# ── Fetch functions ──────────────────────────────────────────────────────

def fetch_tiktok_posts(username: str, max_posts: int = 20) -> list[dict]:
    """Fetch TikTok posts for a username via Apify clockworks/tiktok-scraper.

    Returns normalized list of post dicts.
    """
    if username.startswith("@"):
        username = username[1:]

    input_data = {
        "profiles": [username],
        "resultsPerPage": max_posts,
    }

    raw_items = _run_apify_actor(ACTOR_TIKTOK_POSTS, input_data, timeout=300)
    if not raw_items:
        return []

    normalized = []
    for item in raw_items:
        # The actor may return profile info mixed with posts — skip non-video items
        post_id = str(
            item.get("id", "")
            or item.get("videoId", "")
            or item.get("aweme_id", "")
        )
        if not post_id:
            continue

        content = item.get("desc", "") or item.get("text", "") or ""
        web_url = (
            item.get("webVideoUrl", "")
            or item.get("url", "")
            or item.get("videoUrl", "")
            or f"https://www.tiktok.com/@{username}/video/{post_id}"
        )

        published_at = _parse_timestamp(
            item.get("createTimeISO")
            or item.get("createTime")
        )

        normalized.append({
            "platform_post_id": post_id,
            "content_text": content,
            "like_count": _safe_int(item.get("diggCount", 0) or item.get("likes", 0)),
            "comment_count": _safe_int(item.get("commentCount", 0) or item.get("comments", 0)),
            "share_count": _safe_int(item.get("shareCount", 0) or item.get("shares", 0)),
            "view_count": _safe_int(item.get("playCount", 0) or item.get("views", 0)),
            "post_url": web_url,
            "published_at": published_at,
            "raw": item,
        })

    logger.info("TikTok ingest: Fetched %d posts for @%s", len(normalized), username)
    return normalized


def fetch_tiktok_comments(post_url: str, max_comments: int = 200) -> list[dict]:
    """Fetch comments for a TikTok post via Apify clockworks/tiktok-comments-scraper.

    Returns normalized list of comment dicts.
    """
    input_data = {
        "postURLs": [post_url],
        "maxComments": max_comments,
    }

    raw_items = _run_apify_actor(ACTOR_TIKTOK_COMMENTS, input_data, timeout=300)
    if not raw_items:
        return []

    normalized = []
    for item in raw_items:
        comment_id = str(
            item.get("cid", "")
            or item.get("id", "")
            or item.get("commentId", "")
        )
        text = item.get("text", "") or item.get("comment", "") or ""
        if not comment_id or not text:
            continue

        author_username = (
            item.get("uniqueId", "")
            or item.get("username", "")
            or item.get("unique_id", "")
            or ""
        )
        author_name = (
            item.get("nickname", "")
            or item.get("name", "")
            or author_username
        )

        published_at = _parse_timestamp(
            item.get("createTimeISO")
            or item.get("createTime")
        )

        normalized.append({
            "platform_comment_id": comment_id,
            "text": text,
            "author_username": author_username,
            "author_name": author_name,
            "like_count": _safe_int(item.get("diggCount", 0) or item.get("likes", 0)),
            "published_at": published_at,
            "raw": item,
        })

    logger.info("TikTok ingest: Fetched %d comments for %s", len(normalized), post_url)
    return normalized


def fetch_tiktok_profiles(usernames: list[str]) -> list[dict]:
    """Fetch TikTok profile data for a list of usernames via Apify.

    Used for demographics enrichment.
    Returns list of profile dicts.
    """
    if not usernames:
        return []

    # Clean usernames
    clean = [u.lstrip("@").lower() for u in usernames if u]
    if not clean:
        return []

    input_data = {
        "usernames": clean,
    }

    raw_items = _run_apify_actor(ACTOR_TIKTOK_PROFILES, input_data, timeout=300)
    if not raw_items:
        return []

    profiles = []
    for item in raw_items:
        uname = (
            item.get("uniqueId", "")
            or item.get("username", "")
            or ""
        )
        if not uname:
            continue

        profiles.append({
            "username": uname.lower(),
            "display_name": item.get("nickname", "") or item.get("name", ""),
            "bio": item.get("signature", "") or item.get("bio", ""),
            "followers_count": _safe_int(item.get("followerCount", 0) or item.get("fans", 0)),
            "following_count": _safe_int(item.get("followingCount", 0)),
            "likes_count": _safe_int(item.get("heartCount", 0) or item.get("heart", 0)),
            "video_count": _safe_int(item.get("videoCount", 0)),
            "profile_url": f"https://www.tiktok.com/@{uname}",
            "avatar_url": item.get("avatarLarger", "") or item.get("avatarMedium", ""),
            "verified": bool(item.get("verified", False)),
            "platform": "tiktok",
            "raw": item,
        })

    logger.info("TikTok ingest: Fetched %d profiles", len(profiles))
    return profiles


# ── Main ingestion pipeline ──────────────────────────────────────────────

def ingest_tiktok_profile(
    db: Session,
    connection: SocialConnection,
    max_posts: int = 20,
    max_comments_per_post: int = 200,
    progress_callback=None,
    step_callback=None,
    mode: str = "full",
) -> dict:
    """Full TikTok ingestion: fetch posts + comments and save to DB.

    Follows the same pattern as ingest_twitter_profile / ingest_instagram_profile.
    """
    username = connection.username
    if username.startswith("@"):
        username = username[1:]

    # Daily mode: only check last 5 posts
    if mode == "daily":
        return _ingest_tiktok_daily(
            db, connection, username,
            max_comments_per_post=max_comments_per_post,
            progress_callback=progress_callback,
            step_callback=step_callback,
        )

    if step_callback:
        step_callback(f"Buscando posts do TikTok @{username}...")

    # Fetch posts
    raw_posts = fetch_tiktok_posts(username, max_posts=max_posts)
    if not raw_posts:
        logger.warning("TikTok ingest: No posts fetched for @%s", username)
        if step_callback:
            step_callback(f"Nenhum post encontrado para @{username}")
        return {"posts_fetched": 0, "comments_fetched": 0}

    posts_fetched = 0
    comments_fetched = 0

    for idx, raw_post in enumerate(raw_posts, 1):
        post_id = raw_post["platform_post_id"]
        if not post_id:
            continue

        content = raw_post.get("content_text", "")
        content_clean = _clean_text(content)

        # Upsert post
        existing_post = (
            db.query(Post)
            .filter(
                Post.connection_id == connection.id,
                Post.platform_post_id == post_id,
                Post.platform == "tiktok",
            )
            .first()
        )

        if existing_post:
            existing_post.content_text = content
            existing_post.content_clean = content_clean
            existing_post.like_count = raw_post.get("like_count", 0)
            existing_post.comment_count_api = raw_post.get("comment_count", 0)
            existing_post.share_count = raw_post.get("share_count", 0)
            existing_post.view_count = raw_post.get("view_count", 0)
            existing_post.published_at = raw_post.get("published_at")
            existing_post.post_url = raw_post.get("post_url", "")
            existing_post.raw_payload = raw_post.get("raw")
            existing_post.fetched_at = datetime.now(timezone.utc)
            post = existing_post
        else:
            post = Post(
                connection_id=connection.id,
                platform="tiktok",
                platform_post_id=post_id,
                post_type="video",
                content_text=content,
                content_clean=content_clean,
                media_urls=None,
                like_count=raw_post.get("like_count", 0),
                comment_count=0,
                comment_count_api=raw_post.get("comment_count", 0),
                share_count=raw_post.get("share_count", 0),
                view_count=raw_post.get("view_count", 0),
                published_at=raw_post.get("published_at"),
                post_url=raw_post.get("post_url", ""),
                raw_payload=raw_post.get("raw"),
                fetched_at=datetime.now(timezone.utc),
            )
            db.add(post)

        db.flush()
        posts_fetched += 1

        # Fetch comments for this post
        post_url = raw_post.get("post_url", "")
        if not post_url:
            logger.warning("TikTok ingest: No URL for post %s, skipping comments", post_id)
            if progress_callback:
                progress_callback(posts_fetched, comments_fetched)
            continue

        if step_callback:
            step_callback(f"Buscando comentários do post {idx}/{len(raw_posts)}...")

        replies = fetch_tiktok_comments(post_url, max_comments=max_comments_per_post)

        for reply in replies:
            text_original = reply.get("text", "")
            text_clean = _clean_text(text_original)
            text_hash = _hash(text_clean)

            comment_id = reply.get("platform_comment_id", "")
            if not comment_id:
                continue

            # Parse comment published_at
            comment_published_at = reply.get("published_at")

            # Upsert comment
            existing_comment = (
                db.query(Comment)
                .filter(
                    Comment.post_id == post.id,
                    Comment.platform_comment_id == comment_id,
                )
                .first()
            )

            if existing_comment:
                existing_comment.author_name = reply.get("author_name", "")
                existing_comment.author_username = reply.get("author_username", "")
                existing_comment.like_count = reply.get("like_count", 0)
                existing_comment.text_original = text_original
                existing_comment.text_clean = text_clean
                existing_comment.text_hash = text_hash
                existing_comment.published_at = comment_published_at
                existing_comment.raw_payload = reply.get("raw")
            else:
                comment = Comment(
                    post_id=post.id,
                    connection_id=connection.id,
                    platform="tiktok",
                    platform_comment_id=comment_id,
                    parent_comment_id=None,
                    source_type="comment",
                    author_name=reply.get("author_name", ""),
                    author_username=reply.get("author_username", ""),
                    author_profile_url=(
                        f"https://www.tiktok.com/@{reply.get('author_username', '')}"
                        if reply.get("author_username")
                        else None
                    ),
                    like_count=reply.get("like_count", 0),
                    reply_count=0,
                    published_at=comment_published_at,
                    text_original=text_original,
                    text_clean=text_clean,
                    text_hash=text_hash,
                    raw_payload=reply.get("raw"),
                    status="pending",
                )
                db.add(comment)
            comments_fetched += 1

        if progress_callback:
            progress_callback(posts_fetched, comments_fetched)

    # Update connection sync timestamp
    connection.last_sync_at = datetime.now(timezone.utc)
    db.commit()

    if step_callback:
        step_callback(f"TikTok @{username}: {posts_fetched} posts, {comments_fetched} comentários extraídos")

    logger.info("TikTok ingest @%s: %d posts, %d comments ingested", username, posts_fetched, comments_fetched)
    return {"posts_fetched": posts_fetched, "comments_fetched": comments_fetched}


def _ingest_tiktok_daily(
    db: Session,
    connection: SocialConnection,
    username: str,
    max_comments_per_post: int = 200,
    progress_callback=None,
    step_callback=None,
) -> dict:
    """Daily mode: only check last 5 TikToks for new comments + detect new posts."""
    from sqlalchemy import func as sqlfunc

    _step = step_callback or (lambda msg: None)
    _step(f"Daily mode: verificando últimos 5 TikToks de @{username}...")

    posts_fetched = 0
    comments_fetched = 0

    # Get last 5 posts from DB
    recent_posts = (
        db.query(Post)
        .filter(Post.connection_id == connection.id, Post.platform == "tiktok")
        .order_by(Post.published_at.desc())
        .limit(5)
        .all()
    )
    recent_post_ids = {p.platform_post_id for p in recent_posts}

    # Fetch latest posts from Apify
    raw_posts = fetch_tiktok_posts(username, max_posts=10)
    if not raw_posts:
        _step(f"Nenhum post encontrado para @{username}")
        return {"posts_fetched": 0, "comments_fetched": 0}

    comment_counts = dict(
        db.query(Comment.post_id, sqlfunc.count(Comment.id))
        .filter(Comment.connection_id == connection.id)
        .group_by(Comment.post_id)
        .all()
    )

    posts_to_fetch_comments = []  # (post_obj, post_url)

    for raw_post in raw_posts:
        post_id = raw_post["platform_post_id"]
        if not post_id:
            continue

        if post_id in recent_post_ids:
            # Existing post — update stats and check comment count
            existing = next((p for p in recent_posts if p.platform_post_id == post_id), None)
            if not existing:
                continue

            api_comment_count = raw_post.get("comment_count", 0)
            existing.comment_count_api = api_comment_count
            existing.like_count = raw_post.get("like_count", 0)
            existing.share_count = raw_post.get("share_count", 0)
            existing.view_count = raw_post.get("view_count", 0)
            existing.fetched_at = datetime.now(timezone.utc)

            db_count = comment_counts.get(existing.id, 0)
            if api_comment_count > db_count:
                post_url = raw_post.get("post_url", "")
                if post_url:
                    posts_to_fetch_comments.append((existing, post_url))
                    _step(f"Post {post_id}: API={api_comment_count} > DB={db_count}")
        else:
            # Potential new post — only if newer than our newest
            post_timestamp = raw_post.get("published_at")
            newest_date = max((p.published_at for p in recent_posts if p.published_at), default=None) if recent_posts else None
            if newest_date and post_timestamp and post_timestamp < newest_date:
                continue

            content = raw_post.get("content_text", "")
            content_clean = _clean_text(content)

            post = Post(
                connection_id=connection.id,
                platform="tiktok",
                platform_post_id=post_id,
                post_type="video",
                content_text=content,
                content_clean=content_clean,
                media_urls=None,
                like_count=raw_post.get("like_count", 0),
                comment_count=0,
                comment_count_api=raw_post.get("comment_count", 0),
                share_count=raw_post.get("share_count", 0),
                view_count=raw_post.get("view_count", 0),
                published_at=post_timestamp,
                post_url=raw_post.get("post_url", ""),
                raw_payload=raw_post.get("raw"),
                fetched_at=datetime.now(timezone.utc),
            )
            db.add(post)
            db.flush()
            posts_fetched += 1
            _step(f"Novo post encontrado: {post_id}")

            post_url = raw_post.get("post_url", "")
            if post_url:
                posts_to_fetch_comments.append((post, post_url))

    db.commit()

    # Fetch comments for posts that need them
    for idx, (post_obj, post_url) in enumerate(posts_to_fetch_comments, 1):
        _step(f"Buscando comentários do post {idx}/{len(posts_to_fetch_comments)}...")

        replies = fetch_tiktok_comments(post_url, max_comments=max_comments_per_post)

        existing_comment_ids = set(
            row[0] for row in
            db.query(Comment.platform_comment_id)
            .filter(Comment.post_id == post_obj.id)
            .all()
        )

        for reply in replies:
            text_original = reply.get("text", "")
            text_clean = _clean_text(text_original)
            text_hash = _hash(text_clean)

            comment_id = reply.get("platform_comment_id", "")
            if not comment_id or comment_id in existing_comment_ids:
                continue

            comment_published_at = reply.get("published_at")

            comment = Comment(
                post_id=post_obj.id,
                connection_id=connection.id,
                platform="tiktok",
                platform_comment_id=comment_id,
                parent_comment_id=None,
                source_type="comment",
                author_name=reply.get("author_name", ""),
                author_username=reply.get("author_username", ""),
                author_profile_url=(
                    f"https://www.tiktok.com/@{reply.get('author_username', '')}"
                    if reply.get("author_username")
                    else None
                ),
                like_count=reply.get("like_count", 0),
                reply_count=0,
                published_at=comment_published_at,
                text_original=text_original,
                text_clean=text_clean,
                text_hash=text_hash,
                raw_payload=reply.get("raw"),
                status="pending",
            )
            db.add(comment)
            comments_fetched += 1

        if progress_callback:
            progress_callback(posts_fetched, comments_fetched)

    connection.last_sync_at = datetime.now(timezone.utc)
    db.commit()

    _step(f"TikTok daily @{username}: {posts_fetched} novos, {comments_fetched} comentários")
    logger.info("TikTok daily @%s: %d posts, %d comments", username, posts_fetched, comments_fetched)
    return {"posts_fetched": posts_fetched, "comments_fetched": comments_fetched}
