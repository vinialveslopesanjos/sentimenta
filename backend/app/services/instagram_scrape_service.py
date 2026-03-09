"""
Instagram Public Scraping Service via XPoz

Uses XPoz MCP tools for reliable post and comment extraction.
- getInstagramUser (profile)
- getInstagramPostsByUser (listing)
- getInstagramCommentsByPostId (comments)
"""

import logging
import re
import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.social_connection import SocialConnection

logger = logging.getLogger(__name__)

def _xpoz_call(name: str, arguments: dict, async_poll: bool = False) -> dict:
    from app.services.xpoz_service import _call_mcp, _call_mcp_with_polling, _get_text
    if async_poll:
        res = _call_mcp_with_polling(name, arguments)
    else:
        res = _call_mcp(name, arguments)
    return {"raw": res, "text": _get_text(res)}

def _safe_int(val) -> int:
    try:
        if not val: return 0
        return int(str(val).replace(",", "").strip())
    except:
        return 0

def _parse_xpoz_list(text: str) -> list[dict]:
    """Parses XPoz block text into a list of dictionaries based on empty lines."""
    items = []
    current = {}
    for line in text.split("\n"):
        s = line.strip()
        if not s:
            if current:
                items.append(current)
                current = {}
            continue
        if ":" in s:
            k, _, v = s.partition(":")
            current[k.strip()] = v.strip().strip('"')
    if current:
        items.append(current)
    return items

def discover_profile_info(username: str) -> Optional[dict]:
    """Fetch public Instagram profile info using XPoz."""
    from app.services.xpoz_service import get_instagram_profile
    prof = get_instagram_profile(username.replace("@", ""))
    if not prof:
        return None
    
    return {
        "username": prof.get("username", username),
        "full_name": prof.get("fullName", username),
        "biography": prof.get("biography", ""),
        "followers": _safe_int(prof.get("followerCount")),
        "following": _safe_int(prof.get("followingCount")),
        "post_count": _safe_int(prof.get("mediaCount")),
        "profile_pic_url": prof.get("profilePicUrl"),
        "is_private": prof.get("isPrivate", "false").lower() == "true",
        "is_verified": prof.get("isVerified", "false").lower() == "true",
        "external_url": prof.get("externalUrl", ""),
    }

def create_instagram_connection(db: Session, user_id: str, username: str) -> Optional[SocialConnection]:
    """Create or update a SocialConnection for Instagram."""
    prof = discover_profile_info(username)
    if not prof:
        return None
        
    existing = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == user_id,
            SocialConnection.platform == "instagram",
            SocialConnection.username == prof.get("username", username),
        )
        .first()
    )

    if existing:
        existing.display_name = prof.get("full_name") or prof.get("username", username)
        existing.followers_count = prof.get("followers", 0)
        existing.following_count = prof.get("following", 0)
        existing.media_count = prof.get("post_count", 0)
        # Prefer Apify profile pic (fresher CDN URL, avoids CORS blocks)
        profile_pic = prof.get("profile_pic_url")
        try:
            from app.services.apify_service import fetch_profile_pic_apify
            apify_pic = fetch_profile_pic_apify(username)
            if apify_pic:
                profile_pic = apify_pic
        except Exception:
            pass
        existing.profile_image_url = profile_pic
        existing.raw_profile_json = prof
        existing.status = "active"
        db.commit()
        db.refresh(existing)
        return existing

    # Prefer Apify profile pic (fresher CDN URL, avoids CORS blocks)
    profile_pic = prof.get("profile_pic_url")
    try:
        from app.services.apify_service import fetch_profile_pic_apify
        apify_pic = fetch_profile_pic_apify(username)
        if apify_pic:
            profile_pic = apify_pic
    except Exception:
        pass

    conn = SocialConnection(
        user_id=user_id,
        platform="instagram",
        platform_user_id=prof.get("username", username),
        username=prof.get("username", username),
        display_name=prof.get("full_name") or prof.get("username", username),
        profile_url=f"https://instagram.com/{prof.get('username', username)}",
        profile_image_url=profile_pic,
        followers_count=prof.get("followers", 0),
        following_count=prof.get("following", 0),
        media_count=prof.get("post_count", 0),
        status="active",
        raw_profile_json=prof,
        connected_at=datetime.now(timezone.utc),
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn

def fetch_recent_posts(username: str, max_posts: int = 10, since_date=None) -> list[dict]:
    """Fetch recent posts using XPoz getInstagramPostsByUser, parsed by LLM."""
    username = username.replace("@", "")
    res = _xpoz_call("getInstagramPostsByUser", {
        "identifier": username,
        "identifierType": "username",
        "limit": max_posts,
        "userPrompt": f"Get {max_posts} recent posts from instagram user {username}"
    })
    
    text = res.get("text", "")

    # Try pure Python parser first, fall back to LLM
    from app.services.xpoz_parser import parse_xpoz_posts
    data = parse_xpoz_posts(text)
    if not data.get("items"):
        logger.info("CSV parser returned no posts, falling back to LLM parser")
        from app.services.xpoz_parser_llm import parse_xpoz_data_with_llm, ListOfPosts
        data = parse_xpoz_data_with_llm(text, ListOfPosts)

    posts = []
    for item in data.get("items", []):
        post_id = str(item.get("id", ""))
        if not post_id: continue

        # Infer post type: view_count > 0 suggests video/reel
        views = _safe_int(item.get("views", 0))
        post_type = "video" if views > 0 else "image"

        posts.append({
            "platform_post_id": post_id,
            "post_type": post_type,
            "caption": item.get("text", ""),
            "media_url": item.get("url", ""),
            "permalink": f"https://www.instagram.com/p/{item.get('shortcode', post_id.split('_')[0])}/",
            "timestamp": item.get("timestamp"),
            "like_count": _safe_int(item.get("likes", 0)),
            "comment_count": _safe_int(item.get("comments", 0)),
            "view_count": _safe_int(item.get("views", 0)),
        })
    return posts

def fetch_post_thumbnail(platform_post_id: str) -> Optional[str]:
    """Fetch the thumbnail URL for an Instagram post via Apify fallback.

    Args:
        platform_post_id: The platform_post_id in format 'mediaid_userid'

    Returns:
        The image URL string, or None if not available.
    """
    try:
        from app.services.apify_service import fetch_post_thumbnail_apify
        # Extract shortcode from platform_post_id for Apify
        shortcode = platform_post_id.split("_")[0]
        url = fetch_post_thumbnail_apify(shortcode)
        if url:
            return url
        logger.warning("Apify returned no thumbnail for %s", platform_post_id)
        return None
    except Exception as exc:
        logger.error("Failed to fetch thumbnail for %s: %s", platform_post_id, exc)
        return None


def fetch_post_thumbnails(platform_post_ids: list[str], delay: float = 2.5) -> dict[str, str]:
    """Fetch thumbnail URLs for multiple posts with rate limiting.

    Returns:
        Dict mapping platform_post_id -> image URL
    """
    results = {}
    for i, post_id in enumerate(platform_post_ids):
        url = fetch_post_thumbnail(post_id)
        if url:
            results[post_id] = url
        if i < len(platform_post_ids) - 1:
            time.sleep(delay)
    return results


def fetch_post_comments(post_id: str, max_comments: int = 100) -> list[dict]:
    """Fetch comments using XPoz getInstagramCommentsByPostId, parsed by LLM."""
    res = _xpoz_call("getInstagramCommentsByPostId", {
        "postId": post_id,
        "limit": max_comments,
        "userPrompt": f"Get comments for instagram post {post_id}"
    }, async_poll=True)
    
    text = res.get("text", "")

    # Try pure Python parser first, fall back to LLM
    from app.services.xpoz_parser import parse_xpoz_comments
    data = parse_xpoz_comments(text)
    if not data.get("items"):
        logger.info("CSV parser returned no comments, falling back to LLM parser")
        from app.services.xpoz_parser_llm import parse_xpoz_data_with_llm, ListOfComments
        data = parse_xpoz_data_with_llm(text, ListOfComments)

    comments = []
    for item in data.get("items", []):
        text_val = item.get("text", "")
        if not text_val: continue
        
        comments.append({
            "platform_comment_id": str(item.get("id", "")),
            "text": text_val,
            "username": str(item.get("username", "")),
            "timestamp": str(item.get("timestamp", "")),
            "like_count": _safe_int(item.get("likes", 0)),
            "parent_id": None,
        })
    return comments
