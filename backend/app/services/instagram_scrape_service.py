"""
Instagram Public Scraping Service

Uses Apify's instagram-comment-scraper actor for reliable comment extraction
from public posts. Falls back to instaloader for profile discovery and post listing.
"""

import logging
from datetime import date, datetime, timezone
from typing import Optional

import instaloader
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.social_connection import SocialConnection

logger = logging.getLogger(__name__)


def _get_apify_client():
    """Get Apify client if token is configured."""
    if not settings.APIFY_API_TOKEN:
        return None
    try:
        from apify_client import ApifyClient
        return ApifyClient(settings.APIFY_API_TOKEN)
    except ImportError:
        logger.warning("apify-client not installed, falling back to instaloader")
        return None


def discover_profile_info(username: str) -> Optional[dict]:
    """
    Fetch public Instagram profile info using instaloader.
    """
    from app.services.xpoz_service import get_instagram_profile
    prof = get_instagram_profile(username)
    if not prof:
        logger.error(f"Instagram profile @{username} not found via XPoz")
        return None
    
    def safe_int(val):
        try:
            return int(val)
        except:
            return 0

    return {
        "username": prof.get("username", username),
        "full_name": prof.get("fullName", username),
        "biography": prof.get("biography", ""),
        "followers": safe_int(prof.get("followerCount")),
        "following": safe_int(prof.get("followingCount")),
        "post_count": safe_int(prof.get("mediaCount")),
        "profile_pic_url": prof.get("profilePicUrl"),
        "is_private": prof.get("isPrivate", "false").lower() == "true",
        "is_verified": prof.get("isVerified", "false").lower() == "true",
        "external_url": prof.get("externalUrl", ""),
    }


def create_instagram_connection(
    db: Session,
    user_id: str,
    username: str,
) -> Optional[SocialConnection]:
    """
    Create a SocialConnection for Instagram using public scraping.
    """
    profile_info = discover_profile_info(username)

    if not profile_info:
        return None

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
        existing.display_name = profile_info["full_name"]
        existing.followers_count = profile_info["followers"]
        existing.following_count = profile_info["following"]
        existing.media_count = profile_info["post_count"]
        existing.profile_image_url = profile_info["profile_pic_url"]
        existing.raw_profile_json = profile_info
        existing.status = "active"
        db.commit()
        db.refresh(existing)
        return existing

    connection = SocialConnection(
        user_id=user_id,
        platform="instagram",
        platform_user_id=profile_info["username"],
        username=profile_info["username"],
        display_name=profile_info["full_name"],
        profile_url=f"https://www.instagram.com/{profile_info['username']}/",
        profile_image_url=profile_info["profile_pic_url"],
        followers_count=profile_info["followers"],
        following_count=profile_info["following"],
        media_count=profile_info["post_count"],
        status="active",
        raw_profile_json=profile_info,
        connected_at=datetime.now(timezone.utc),
    )

    db.add(connection)
    db.commit()
    db.refresh(connection)

    logger.info(f"Instagram connection created for @{username} (scraping mode)")
    return connection


def fetch_recent_posts(username: str, max_posts: int = 10, since_date: Optional[date] = None) -> list[dict]:
    """
    Fetch recent posts from a public Instagram profile using instaloader.
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

            if since_date and post.date_utc and post.date_utc.date() < since_date:
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


def fetch_post_comments_apify(shortcode: str, max_comments: int = 100) -> list[dict]:
    """
    Fetch comments from an Instagram post using Apify's instagram-comment-scraper.

    This is the preferred method - reliable, no login required, handles rate limits.
    """
    client = _get_apify_client()
    if not client:
        return []

    post_url = f"https://www.instagram.com/p/{shortcode}/"
    logger.info(f"Fetching comments via Apify for post {shortcode} (limit: {max_comments})")

    try:
        run = client.actor("apify/instagram-comment-scraper").call(
            run_input={
                "directUrls": [post_url],
                "resultsLimit": max_comments,
            },
            timeout_secs=120,
        )

        comments = []
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            # Normalize Apify output to our internal format
            username = (
                item.get("ownerUsername", "")
                or (item.get("owner", {}) or {}).get("username", "")
            )
            timestamp = item.get("timestamp", None)
            # Apify may return timestamp as ISO string or epoch
            if isinstance(timestamp, (int, float)):
                timestamp = datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()

            comments.append({
                "platform_comment_id": str(item.get("id", "")),
                "text": item.get("text", ""),
                "username": username,
                "timestamp": timestamp,
                "like_count": item.get("likesCount", 0) or item.get("likes_count", 0) or 0,
                "parent_id": None,
            })

        logger.info(f"Apify fetched {len(comments)} comments from post {shortcode}")
        return comments

    except Exception as e:
        logger.error(f"Apify error fetching comments for post {shortcode}: {e}")
        return []


def fetch_post_comments_instaloader(shortcode: str, max_comments: int = 100) -> list[dict]:
    """
    Fetch comments from an Instagram post using instaloader (fallback).
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
                "parent_id": None,
            })

        logger.info(f"Instaloader fetched {len(comments)} comments from post {shortcode}")
        return comments

    except Exception as e:
        logger.error(f"Instaloader error fetching comments for post {shortcode}: {e}")
        return []


def fetch_post_comments(shortcode: str, max_comments: int = 100) -> list[dict]:
    """
    Fetch comments from an Instagram post.

    Strategy:
    1. Try Apify first (reliable, no login needed)
    2. Fall back to instaloader if Apify is not configured or fails
    """
    if settings.APIFY_API_TOKEN:
        comments = fetch_post_comments_apify(shortcode, max_comments)
        if comments:
            return comments
        logger.warning(f"Apify returned no comments for {shortcode}, trying instaloader fallback")

    return fetch_post_comments_instaloader(shortcode, max_comments)
