"""
YouTube ingestion service.

Uses yt-dlp directly to discover channels and ingest video comments into PostgreSQL.
"""

import re
import uuid
import hashlib
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.post import Post
from app.models.comment import Comment
from app.models.social_connection import SocialConnection


# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """Basic text cleaning: strip, collapse whitespace."""
    if not text:
        return ""
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    return text


def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def discover_channel_info(channel_handle: str) -> dict | None:
    """Return basic channel information, or None if not found.
    
    Uses yt-dlp to verify channel exists and retrieve metadata.
    """
    import yt_dlp

    if not channel_handle.startswith("@"):
        channel_handle = f"@{channel_handle}"

    channel_url = f"https://www.youtube.com/{channel_handle}/videos"

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "playlist_items": "1",
        "skip_download": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(channel_url, download=False)
            if not info:
                return None

            entries = info.get("entries", [])
            if not entries:
                return None

            first_entry = entries[0]
            channel_id = info.get("channel_id") or info.get("uploader_id")
            channel_title = info.get("channel") or info.get("uploader") or channel_handle

            return {
                "channel_id": channel_id,
                "channel_title": channel_title,
                "latest_video_id": first_entry.get("id"),
            }
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"yt-dlp discover_channel_info error: {e}")
        return None


def _get_video_info(video_id: str) -> dict:
    """Fetch metadata for a single video."""
    import yt_dlp

    video_url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            return {
                "title": info.get("title", ""),
                "channel_id": info.get("channel_id"),
                "channel_title": info.get("uploader") or info.get("channel"),
                "like_count": info.get("like_count", 0) or 0,
                "view_count": info.get("view_count", 0) or 0,
                "comment_count": info.get("comment_count", 0) or 0,
                "published_at": info.get("upload_date"),  # YYYYMMDD
            }
    except Exception:
        return {}


def _fetch_comments(video_id: str, max_comments: int = 100) -> list[dict]:
    """Fetch comments for a video using yt-dlp."""
    import yt_dlp

    video_url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "getcomments": True,
        "extractor_args": {
            "youtube": {
                "max_comments": [str(max_comments)],
                "comment_sort": ["top"],
            }
        },
    }

    comments = []
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            raw_comments = info.get("comments") or []
            for c in raw_comments[:max_comments]:
                text = c.get("text", "")
                if not text:
                    continue
                comments.append({
                    "comment_id": c.get("id", ""),
                    "text_original": text,
                    "author_name": c.get("author", ""),
                    "author_channel_id": c.get("author_id", ""),
                    "like_count": c.get("like_count", 0) or 0,
                    "reply_count": c.get("reply_count", 0) or 0,
                    "raw_payload": c,
                })
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"yt-dlp fetch_comments error: {e}")

    return comments


# ---------------------------------------------------------------------------
# Main ingestion function
# ---------------------------------------------------------------------------

async def ingest_youtube_channel(
    db: Session,
    connection_id: uuid.UUID,
    max_comments: int = 100,
) -> dict:
    """Ingest the latest video and its comments for a YouTube connection."""

    # -- 1. Retrieve connection
    connection: SocialConnection | None = db.get(SocialConnection, connection_id)
    if connection is None:
        raise ValueError(f"SocialConnection {connection_id} not found")

    channel_handle = connection.username

    # -- 2. Discover latest video
    info = discover_channel_info(channel_handle)
    if not info or not info.get("latest_video_id"):
        raise RuntimeError(
            f"Could not discover latest video for channel {channel_handle}"
        )

    latest_video_id = info["latest_video_id"]

    # -- 3. Fetch video metadata and save Post
    video_info = _get_video_info(latest_video_id)

    published_at = None
    raw_date = video_info.get("published_at")
    if raw_date:
        try:
            published_at = datetime.strptime(raw_date, "%Y%m%d").replace(
                tzinfo=timezone.utc
            )
        except (ValueError, TypeError):
            pass

    title = video_info.get("title", "")
    title_clean = clean_text(title)

    existing_post = (
        db.query(Post)
        .filter(
            Post.connection_id == connection_id,
            Post.platform_post_id == latest_video_id,
            Post.platform == "youtube",
        )
        .first()
    )

    if existing_post:
        existing_post.content_text = title
        existing_post.content_clean = title_clean
        existing_post.like_count = video_info.get("like_count", 0)
        existing_post.comment_count = video_info.get("comment_count", 0)
        existing_post.view_count = video_info.get("view_count", 0)
        existing_post.published_at = published_at
        existing_post.raw_payload = video_info
        existing_post.fetched_at = datetime.now(timezone.utc)
        post = existing_post
    else:
        post = Post(
            connection_id=connection_id,
            platform="youtube",
            platform_post_id=latest_video_id,
            post_type="video",
            content_text=title,
            content_clean=title_clean,
            media_urls=None,
            like_count=video_info.get("like_count", 0),
            comment_count=video_info.get("comment_count", 0),
            share_count=0,
            view_count=video_info.get("view_count", 0),
            published_at=published_at,
            post_url=f"https://www.youtube.com/watch?v={latest_video_id}",
            raw_payload=video_info,
            fetched_at=datetime.now(timezone.utc),
        )
        db.add(post)

    db.flush()

    posts_fetched = 1

    # -- 4. Fetch comments and save
    comments_fetched = 0

    for raw_comment in _fetch_comments(latest_video_id, max_comments):
        text_original = raw_comment.get("text_original", "")
        text_cleaned = clean_text(text_original)
        text_hash = compute_hash(text_cleaned)

        platform_comment_id = raw_comment.get("comment_id", "")
        if not platform_comment_id:
            continue

        existing_comment = (
            db.query(Comment)
            .filter(
                Comment.post_id == post.id,
                Comment.platform_comment_id == platform_comment_id,
            )
            .first()
        )

        if existing_comment:
            existing_comment.author_name = raw_comment.get("author_name")
            existing_comment.like_count = raw_comment.get("like_count", 0)
            existing_comment.reply_count = raw_comment.get("reply_count", 0)
            existing_comment.text_original = text_original
            existing_comment.text_clean = text_cleaned
            existing_comment.text_hash = text_hash
            existing_comment.raw_payload = raw_comment.get("raw_payload")
        else:
            comment = Comment(
                post_id=post.id,
                connection_id=connection_id,
                platform="youtube",
                platform_comment_id=platform_comment_id,
                parent_comment_id=None,
                source_type="comment",
                author_name=raw_comment.get("author_name"),
                author_username=raw_comment.get("author_channel_id"),
                author_profile_url=None,
                like_count=raw_comment.get("like_count", 0),
                reply_count=raw_comment.get("reply_count", 0),
                published_at=None,
                text_original=text_original,
                text_clean=text_cleaned,
                text_hash=text_hash,
                raw_payload=raw_comment.get("raw_payload"),
                status="pending",
            )
            db.add(comment)
        comments_fetched += 1

    # -- 5. Update sync timestamp
    connection.last_sync_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "posts_fetched": posts_fetched,
        "comments_fetched": comments_fetched,
    }
