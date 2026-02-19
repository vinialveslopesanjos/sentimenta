"""
Instagram data ingestion service (public scraping mode).

Similar to youtube_service.py but for Instagram.
"""

import hashlib
import logging
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.comment import Comment
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.services.media_cache_service import cache_remote_image
from app.services.instagram_scrape_service import (
    fetch_post_comments,
    fetch_recent_posts,
)

logger = logging.getLogger(__name__)


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except (ValueError, TypeError):
        return None


def ingest_instagram_profile(
    db: Session,
    connection: SocialConnection,
    max_posts: int = 10,
    max_comments_per_post: int = 100,
    since_date: Optional[date] = None,
) -> dict:
    """
    Ingest recent posts and comments from an Instagram profile.

    Args:
        db: Database session
        connection: SocialConnection instance
        max_posts: Maximum posts to fetch
        max_comments_per_post: Max comments per post

    Returns:
        Dict with stats: posts_fetched, comments_fetched
    """
    username = connection.username
    stats = {
        "posts_fetched": 0,
        "posts_updated": 0,
        "comments_fetched": 0,
        "comments_updated": 0,
        "errors": [],
    }

    try:
        posts_data = fetch_recent_posts(
            username,
            max_posts=max_posts,
            since_date=since_date,
        )

        for post_data in posts_data:
            try:
                post = (
                    db.query(Post)
                    .filter(
                        Post.connection_id == connection.id,
                        Post.platform_post_id == post_data["platform_post_id"],
                    )
                    .first()
                )

                if post:
                    media_url = post_data.get("media_url")
                    if media_url:
                        cache_remote_image(media_url)
                    post.post_type = post_data.get("post_type")
                    post.content_text = post_data.get("caption") or ""
                    post.content_clean = post_data.get("caption") or ""
                    post.media_urls = {
                        "url": media_url,
                        "thumbnail_url": media_url,
                    }
                    post.like_count = post_data.get("like_count", 0) or 0
                    post.comment_count = post_data.get("comment_count", 0) or 0
                    post.view_count = post_data.get("view_count", 0) or 0
                    post.published_at = _parse_timestamp(post_data.get("timestamp"))
                    post.post_url = post_data.get("permalink")
                    post.raw_payload = post_data
                    post.fetched_at = datetime.now(timezone.utc)
                    stats["posts_updated"] += 1
                else:
                    media_url = post_data.get("media_url")
                    if media_url:
                        cache_remote_image(media_url)
                    post = Post(
                        connection_id=connection.id,
                        platform="instagram",
                        platform_post_id=post_data["platform_post_id"],
                        post_type=post_data.get("post_type"),
                        content_text=post_data.get("caption") or "",
                        content_clean=post_data.get("caption") or "",
                        media_urls={
                            "url": media_url,
                            "thumbnail_url": media_url,
                        },
                        like_count=post_data.get("like_count", 0) or 0,
                        comment_count=post_data.get("comment_count", 0) or 0,
                        view_count=post_data.get("view_count", 0) or 0,
                        published_at=_parse_timestamp(post_data.get("timestamp")),
                        post_url=post_data.get("permalink"),
                        raw_payload=post_data,
                        fetched_at=datetime.now(timezone.utc),
                    )
                    db.add(post)
                    db.flush()
                    stats["posts_fetched"] += 1

                comments_data = fetch_post_comments(
                    post_data["platform_post_id"],
                    max_comments=max_comments_per_post,
                )

                for comment_data in comments_data:
                    try:
                        platform_comment_id = str(
                            comment_data.get("platform_comment_id", "")
                        ).strip()
                        if not platform_comment_id:
                            continue

                        text_original = (comment_data.get("text") or "").strip()
                        text_hash = hashlib.sha256(
                            text_original.encode("utf-8")
                        ).hexdigest()

                        existing_comment = (
                            db.query(Comment)
                            .filter(
                                Comment.post_id == post.id,
                                Comment.platform_comment_id == platform_comment_id,
                            )
                            .first()
                        )

                        if existing_comment:
                            existing_comment.author_username = comment_data.get("username")
                            existing_comment.author_name = comment_data.get("username")
                            existing_comment.like_count = (
                                comment_data.get("like_count", 0) or 0
                            )
                            existing_comment.published_at = _parse_timestamp(
                                comment_data.get("timestamp")
                            ) or post.published_at
                            existing_comment.text_original = text_original
                            existing_comment.text_clean = text_original
                            existing_comment.text_hash = text_hash
                            existing_comment.raw_payload = comment_data
                            stats["comments_updated"] += 1
                            continue

                        comment = Comment(
                            post_id=post.id,
                            connection_id=connection.id,
                            platform="instagram",
                            platform_comment_id=platform_comment_id,
                            source_type="comment",
                            author_username=comment_data.get("username"),
                            author_name=comment_data.get("username"),
                            like_count=comment_data.get("like_count", 0) or 0,
                            published_at=_parse_timestamp(comment_data.get("timestamp")) or post.published_at,
                            text_original=text_original,
                            text_clean=text_original,
                            text_hash=text_hash,
                            status="pending",
                            raw_payload=comment_data,
                        )
                        db.add(comment)
                        stats["comments_fetched"] += 1

                    except Exception as exc:
                        logger.error("Error saving comment: %s", exc)
                        stats["errors"].append(str(exc))

            except Exception as exc:
                logger.error(
                    "Error processing post %s: %s",
                    post_data.get("platform_post_id"),
                    exc,
                )
                stats["errors"].append(str(exc))

        db.commit()
        logger.info(
            "Instagram ingestion complete for @%s: %s new posts, %s updated posts, "
            "%s new comments, %s updated comments",
            username,
            stats["posts_fetched"],
            stats["posts_updated"],
            stats["comments_fetched"],
            stats["comments_updated"],
        )

    except Exception as exc:
        logger.error("Instagram ingestion failed for @%s: %s", username, exc)
        stats["errors"].append(str(exc))
        db.rollback()

    return stats
