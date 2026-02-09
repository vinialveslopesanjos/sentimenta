"""
Instagram Public Scraping Service

Uses instaloader to scrape public Instagram profiles without OAuth.
Similar approach to YouTube scraping.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import instaloader
from sqlalchemy.orm import Session

from app.models.social_connection import SocialConnection

logger = logging.getLogger(__name__)


def discover_profile_info(username: str) -> Optional[dict]:
    """
    Fetch public Instagram profile info using instaloader.

    Args:
        username: Instagram username (with or without @)

    Returns:
        Dict with profile info or None if profile not found/private

    Example:
        >>> info = discover_profile_info("@nasa")
        >>> print(info)
        {
            'username': 'nasa',
            'full_name': 'NASA',
            'biography': '...',
            'followers': 12000000,
            'profile_pic_url': '...',
            'is_private': False,
            'post_count': 1234
        }
    """
    # Remove @ if present
    if username.startswith("@"):
        username = username[1:]

    try:
        loader = instaloader.Instaloader(
            quiet=True,
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
        )

        profile = instaloader.Profile.from_username(loader.context, username)

        # Check if profile is private
        if profile.is_private:
            logger.warning(f"Instagram profile @{username} is private")
            return None

        return {
            "username": profile.username,
            "full_name": profile.full_name or profile.username,
            "biography": profile.biography or "",
            "followers": profile.followers,
            "following": profile.followees,
            "post_count": profile.mediacount,
            "profile_pic_url": profile.profile_pic_url,
            "is_private": profile.is_private,
            "is_verified": profile.is_verified,
            "external_url": profile.external_url or "",
        }

    except instaloader.exceptions.ProfileNotExistsException:
        logger.error(f"Instagram profile @{username} not found")
        return None
    except instaloader.exceptions.ConnectionException as e:
        logger.error(f"Instagram connection error for @{username}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching Instagram profile @{username}: {e}")
        return None


def create_instagram_connection(
    db: Session,
    user_id: str,
    username: str,
) -> Optional[SocialConnection]:
    """
    Create a SocialConnection for Instagram using public scraping.

    Args:
        db: Database session
        user_id: User UUID
        username: Instagram username

    Returns:
        SocialConnection instance or None if failed
    """
    profile_info = discover_profile_info(username)

    if not profile_info:
        return None

    # Check if already connected
    existing = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == user_id,
            SocialConnection.platform == "instagram",
            SocialConnection.username == profile_info["username"],
        )
        .first()
    )

    if existing:
        # Update info
        existing.display_name = profile_info["full_name"]
        existing.followers_count = profile_info["followers"]
        existing.profile_image_url = profile_info["profile_pic_url"]
        existing.raw_profile_json = profile_info
        existing.status = "active"
        db.commit()
        db.refresh(existing)
        return existing

    # Create new connection
    connection = SocialConnection(
        user_id=user_id,
        platform="instagram",
        platform_user_id=profile_info["username"],  # use username as ID for scraping
        username=profile_info["username"],
        display_name=profile_info["full_name"],
        profile_url=f"https://www.instagram.com/{profile_info['username']}/",
        profile_image_url=profile_info["profile_pic_url"],
        followers_count=profile_info["followers"],
        status="active",
        raw_profile_json=profile_info,
        connected_at=datetime.now(timezone.utc),
    )

    db.add(connection)
    db.commit()
    db.refresh(connection)

    logger.info(f"Instagram connection created for @{username} (scraping mode)")
    return connection


def fetch_recent_posts(username: str, max_posts: int = 10) -> list[dict]:
    """
    Fetch recent posts from a public Instagram profile.

    Args:
        username: Instagram username
        max_posts: Maximum number of posts to fetch (default 10)

    Returns:
        List of post dictionaries with normalized structure
    """
    if username.startswith("@"):
        username = username[1:]

    try:
        loader = instaloader.Instaloader(
            quiet=True,
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
        )

        profile = instaloader.Profile.from_username(loader.context, username)

        if profile.is_private:
            logger.warning(f"Cannot fetch posts from private profile @{username}")
            return []

        posts = []
        for post in profile.get_posts():
            if len(posts) >= max_posts:
                break

            posts.append({
                "platform_post_id": post.shortcode,
                "post_type": "video" if post.is_video else "image",
                "caption": post.caption or "",
                "media_url": post.url,
                "thumbnail_url": post.url if post.is_video else None,
                "permalink": f"https://www.instagram.com/p/{post.shortcode}/",
                "timestamp": post.date_utc.isoformat() if post.date_utc else None,
                "like_count": post.likes,
                "comment_count": post.comments,
                "view_count": post.video_view_count if post.is_video else 0,
            })

        logger.info(f"Fetched {len(posts)} posts from @{username}")
        return posts

    except Exception as e:
        logger.error(f"Error fetching Instagram posts for @{username}: {e}")
        return []


def fetch_post_comments(shortcode: str, max_comments: int = 100) -> list[dict]:
    """
    Fetch comments from an Instagram post.

    Args:
        shortcode: Instagram post shortcode (from URL: instagram.com/p/SHORTCODE/)
        max_comments: Maximum number of comments to fetch

    Returns:
        List of comment dictionaries
    """
    try:
        loader = instaloader.Instaloader(
            quiet=True,
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
        )

        post = instaloader.Post.from_shortcode(loader.context, shortcode)

        comments = []
        for comment in post.get_comments():
            if len(comments) >= max_comments:
                break

            comments.append({
                "platform_comment_id": str(comment.id),
                "text": comment.text,
                "username": comment.owner.username,
                "timestamp": comment.created_at_utc.isoformat() if comment.created_at_utc else None,
                "like_count": comment.likes_count or 0,
                "parent_id": None,  # instaloader doesn't expose reply structure easily
            })

        logger.info(f"Fetched {len(comments)} comments from post {shortcode}")
        return comments

    except Exception as e:
        logger.error(f"Error fetching comments for post {shortcode}: {e}")
        return []
