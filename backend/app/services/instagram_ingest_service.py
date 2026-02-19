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
from app.services.instagram_scrape_service import (
    fetch_recent_posts,
    fetch_post_comments,
)

logger = logging.getLogger(__name__)


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
    stats = {"posts_fetched": 0, "comments_fetched": 0, "errors": []}

    try:
        # Fetch recent posts
        posts_data = fetch_recent_posts(username, max_posts=max_posts, since_date=since_date)

        for post_data in posts_data:
            try:
                # Check if post already exists
                existing_post = (
                    db.query(Post)
                    .filter(
                        Post.connection_id == connection.id,
                        Post.platform_post_id == post_data["platform_post_id"],
                    )
                    .first()
                )

                if existing_post:
                    logger.debug(
                        f"Post {post_data['platform_post_id']} already exists, skipping"
                    )
                    # Still fetch new comments for existing post
                    post = existing_post
                else:
                    # Create new post
                    post = Post(
                        connection_id=connection.id,
                        platform="instagram",
                        platform_post_id=post_data["platform_post_id"],
                        post_type=post_data["post_type"],
                        content_text=post_data["caption"],
                        content_clean=post_data["caption"],  # Could add cleaning here
                        media_urls={"url": post_data["media_url"]},
                        like_count=post_data["like_count"],
                        comment_count=post_data["comment_count"],
                        view_count=post_data["view_count"],
                        published_at=datetime.fromisoformat(post_data["timestamp"])
                        if post_data["timestamp"]
                        else None,
                        post_url=post_data["permalink"],
                        raw_payload=post_data,
                        fetched_at=datetime.now(timezone.utc),
                    )
                    db.add(post)
                    db.flush()
                    stats["posts_fetched"] += 1
                    logger.info(f"Saved Instagram post: {post_data['platform_post_id']}")

                # Fetch comments for this post
                comments_data = fetch_post_comments(
                    post_data["platform_post_id"], max_comments=max_comments_per_post
                )

                for comment_data in comments_data:
                    try:
                        # Compute hash for deduplication
                        text_clean = comment_data["text"].strip()
                        text_hash = hashlib.sha256(text_clean.encode("utf-8")).hexdigest()

                        # Check if comment exists
                        existing_comment = (
                            db.query(Comment)
                            .filter(
                                Comment.post_id == post.id,
                                Comment.platform_comment_id
                                == comment_data["platform_comment_id"],
                            )
                            .first()
                        )

                        if existing_comment:
                            continue

                        comment = Comment(
                            post_id=post.id,
                            connection_id=connection.id,
                            platform="instagram",
                            platform_comment_id=comment_data["platform_comment_id"],
                            source_type="comment",
                            author_username=comment_data["username"],
                            author_name=comment_data["username"],
                            like_count=comment_data["like_count"],
                            published_at=datetime.fromisoformat(comment_data["timestamp"])
                            if comment_data["timestamp"]
                            else None,
                            text_original=comment_data["text"],
                            text_clean=text_clean,
                            text_hash=text_hash,
                            status="pending",
                            raw_payload=comment_data,
                        )
                        db.add(comment)
                        stats["comments_fetched"] += 1

                    except Exception as e:
                        logger.error(f"Error saving comment: {e}")
                        stats["errors"].append(str(e))

            except Exception as e:
                logger.error(f"Error processing post {post_data.get('platform_post_id')}: {e}")
                stats["errors"].append(str(e))

        db.commit()
        logger.info(
            f"Instagram ingestion complete for @{username}: "
            f"{stats['posts_fetched']} posts, {stats['comments_fetched']} comments"
        )

    except Exception as e:
        logger.error(f"Instagram ingestion failed for @{username}: {e}")
        stats["errors"].append(str(e))
        db.rollback()

    return stats
