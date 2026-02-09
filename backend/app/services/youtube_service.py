"""
YouTube ingestion service.

Wraps the YouTubeScrapeSource from src/sources/youtube_scrape.py
to discover channels and ingest video comments into PostgreSQL.
"""

import sys
import os
import uuid
import hashlib
from pathlib import Path
from datetime import datetime, timezone

from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Allow importing from the project-level src/ directory
# ---------------------------------------------------------------------------
sys.path.insert(
    0, str(Path(__file__).resolve().parent.parent.parent.parent / "src")
)
from sources.youtube_scrape import YouTubeScrapeSource, clean_text, compute_hash

from app.models.post import Post
from app.models.comment import Comment
from app.models.social_connection import SocialConnection


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def discover_channel_info(channel_handle: str) -> dict | None:
    """Return basic channel information, or *None* if the channel cannot be
    found.

    Uses ``YouTubeScrapeSource.discover_latest_video`` to verify the channel
    exists, then ``get_video_info`` on the latest video to retrieve the
    channel title and channel id.

    Returns
    -------
    dict
        ``{"channel_id": str, "channel_title": str, "latest_video_id": str}``
    None
        If the channel does not exist or cannot be reached.
    """
    scraper = YouTubeScrapeSource()

    latest_video_id = scraper.discover_latest_video(channel_handle)
    if not latest_video_id:
        return None

    try:
        video_info = scraper.get_video_info(latest_video_id)
    except Exception:
        # If we can retrieve the video id but not the info, still return
        # what we have.
        return {
            "channel_id": None,
            "channel_title": None,
            "latest_video_id": latest_video_id,
        }

    return {
        "channel_id": video_info.get("channel_id"),
        "channel_title": video_info.get("channel_title"),
        "latest_video_id": latest_video_id,
    }


# ---------------------------------------------------------------------------
# Main ingestion coroutine
# ---------------------------------------------------------------------------

async def ingest_youtube_channel(
    db: Session,
    connection_id: uuid.UUID,
    max_comments: int = 500,
) -> dict:
    """Ingest the latest video and its comments for a YouTube connection.

    Steps
    -----
    1. Load the ``SocialConnection`` record from the database.
    2. Discover the latest video on the channel.
    3. Fetch video metadata and persist it as a ``Post``.
    4. Fetch comments and persist each one as a ``Comment``.
    5. Update ``SocialConnection.last_sync_at``.

    Parameters
    ----------
    db : Session
        Active SQLAlchemy session.
    connection_id : uuid.UUID
        Primary key of the ``SocialConnection`` row.
    max_comments : int, optional
        Upper limit on the number of comments to fetch (default 500).

    Returns
    -------
    dict
        ``{"posts_fetched": int, "comments_fetched": int}``
    """

    # -- 1. Retrieve connection ------------------------------------------------
    connection: SocialConnection | None = db.get(SocialConnection, connection_id)
    if connection is None:
        raise ValueError(f"SocialConnection {connection_id} not found")

    channel_handle = connection.username
    scraper = YouTubeScrapeSource()

    # -- 2. Discover latest video ----------------------------------------------
    latest_video_id = scraper.discover_latest_video(channel_handle)
    if not latest_video_id:
        raise RuntimeError(
            f"Could not discover latest video for channel @{channel_handle}"
        )

    # -- 3. Fetch video metadata and save Post ---------------------------------
    video_info = scraper.get_video_info(latest_video_id)

    # Parse published_at if available (yt-dlp returns YYYYMMDD format)
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

    # Merge so that re-ingesting the same video is an upsert rather than a
    # duplicate-key error.
    post = db.merge(post)
    db.flush()  # ensure post.id is populated

    posts_fetched = 1

    # -- 4. Fetch comments and save --------------------------------------------
    comments_fetched = 0

    for raw_comment in scraper.fetch_comments(latest_video_id, max_comments):
        text_original = raw_comment.get("text_original", "")
        text_cleaned = clean_text(text_original)
        text_hash = hashlib.sha256(text_cleaned.encode("utf-8")).hexdigest()

        platform_comment_id = raw_comment.get("comment_id", "")
        if not platform_comment_id:
            continue

        comment = Comment(
            post_id=post.id,
            connection_id=connection_id,
            platform="youtube",
            platform_comment_id=platform_comment_id,
            parent_comment_id=None,  # kept as DB-level UUID reference; raw parent stored in payload
            source_type="comment",
            author_name=raw_comment.get("author_name"),
            author_username=raw_comment.get("author_channel_id"),
            author_profile_url=None,
            like_count=raw_comment.get("like_count", 0),
            reply_count=raw_comment.get("reply_count", 0),
            published_at=None,  # scrape mode rarely provides an exact datetime
            text_original=text_original,
            text_clean=text_cleaned,
            text_hash=text_hash,
            raw_payload=raw_comment.get("raw_payload"),
            status="pending",
        )

        db.merge(comment)
        comments_fetched += 1

    # -- 5. Update sync timestamp ----------------------------------------------
    connection.last_sync_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "posts_fetched": posts_fetched,
        "comments_fetched": comments_fetched,
    }
