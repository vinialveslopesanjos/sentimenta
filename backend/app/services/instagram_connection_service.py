"""
Instagram connection service — profile discovery and connection creation via Apify.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.social_connection import SocialConnection

logger = logging.getLogger(__name__)


def discover_profile_info(username: str) -> Optional[dict]:
    """Fetch public Instagram profile info using Apify."""
    from app.services.apify_service import fetch_profile_apify

    username = username.replace("@", "")
    prof = fetch_profile_apify(username)
    if not prof:
        return None

    return {
        "username": prof.get("username", username),
        "full_name": prof.get("fullName", username),
        "biography": prof.get("biography", ""),
        "followers": prof.get("followersCount", 0) or 0,
        "following": prof.get("followsCount", 0) or 0,
        "post_count": prof.get("postsCount", 0) or 0,
        "profile_pic_url": prof.get("profilePicUrlHD") or prof.get("profilePicUrl"),
        "is_private": prof.get("private", False),
        "is_verified": prof.get("verified", False),
        "external_url": prof.get("externalUrl", ""),
    }


def create_instagram_connection(db: Session, user_id: str, username: str) -> Optional[SocialConnection]:
    """Create or update a SocialConnection for Instagram using Apify."""
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

    profile_pic = prof.get("profile_pic_url")

    if existing:
        existing.display_name = prof.get("full_name") or prof.get("username", username)
        existing.followers_count = prof.get("followers", 0)
        existing.following_count = prof.get("following", 0)
        existing.media_count = prof.get("post_count", 0)
        existing.profile_image_url = profile_pic
        existing.raw_profile_json = prof
        existing.status = "active"
        db.commit()
        db.refresh(existing)
        return existing

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
