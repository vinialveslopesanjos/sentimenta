"""
Centralized OAuth service: find or create a user from a social login.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.security import encrypt_token
from app.models.social_connection import SocialConnection
from app.models.user import User

logger = logging.getLogger(__name__)


def find_or_create_user_from_social(
    db: Session,
    platform: str,
    platform_user_id: str,
    profile_data: dict,
    access_token: str,
    refresh_token: str | None = None,
    token_expires_at: datetime | None = None,
    scopes: list[str] | None = None,
    raw_profile: dict | None = None,
) -> tuple[User, SocialConnection]:
    """Look up a SocialConnection by (platform, platform_user_id).
    If found, update tokens and return the linked user.
    If not, create a new User with a synthetic email and a new SocialConnection.
    """
    connection = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.platform == platform,
            SocialConnection.platform_user_id == platform_user_id,
        )
        .first()
    )

    if connection:
        # Update tokens on existing connection
        user = db.query(User).filter(User.id == connection.user_id).first()
        connection.access_token_enc = encrypt_token(access_token)
        if refresh_token:
            connection.refresh_token_enc = encrypt_token(refresh_token)
        if token_expires_at:
            connection.token_expires_at = token_expires_at
        if scopes:
            connection.scopes = scopes
        connection.status = "active"
        connection.raw_profile_json = raw_profile or profile_data

        # Update profile fields
        username = profile_data.get("username", connection.username)
        connection.username = username
        connection.display_name = profile_data.get("display_name", connection.display_name)
        connection.profile_image_url = profile_data.get("profile_image_url", connection.profile_image_url)
        connection.followers_count = profile_data.get("followers_count", connection.followers_count)

        # Update user avatar/name if missing
        if user and not user.avatar_url and profile_data.get("profile_image_url"):
            user.avatar_url = profile_data["profile_image_url"]
        if user and not user.name and profile_data.get("display_name"):
            user.name = profile_data["display_name"]

        db.commit()
        db.refresh(connection)
        if user:
            db.refresh(user)
        logger.info("OAuth login: existing user %s via %s/%s", user.id if user else "?", platform, platform_user_id)
        return user, connection

    # No existing connection — create new user + connection
    prefix = "ig" if platform == "instagram" else "tt" if platform == "tiktok" else platform[:2]
    synthetic_email = f"{prefix}_{platform_user_id}@sentimenta.internal"

    # Check if a user with this synthetic email already exists (edge case)
    user = db.query(User).filter(User.email == synthetic_email).first()
    if not user:
        user = User(
            email=synthetic_email,
            name=profile_data.get("display_name") or profile_data.get("username"),
            avatar_url=profile_data.get("profile_image_url"),
        )
        db.add(user)
        db.flush()

    username = profile_data.get("username", platform_user_id)
    connection = SocialConnection(
        user_id=user.id,
        platform=platform,
        platform_user_id=platform_user_id,
        username=username,
        display_name=profile_data.get("display_name", username),
        profile_url=profile_data.get("profile_url"),
        profile_image_url=profile_data.get("profile_image_url"),
        followers_count=profile_data.get("followers_count", 0),
        access_token_enc=encrypt_token(access_token),
        refresh_token_enc=encrypt_token(refresh_token) if refresh_token else None,
        token_expires_at=token_expires_at,
        scopes=scopes,
        status="active",
        raw_profile_json=raw_profile or profile_data,
        connected_at=datetime.now(timezone.utc),
    )
    db.add(connection)
    db.commit()
    db.refresh(user)
    db.refresh(connection)

    logger.info("OAuth login: new user %s created via %s/%s", user.id, platform, platform_user_id)
    return user, connection
