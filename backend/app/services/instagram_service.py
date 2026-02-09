import uuid
import logging
from urllib.parse import urlencode
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import encrypt_token, decrypt_token
from app.models.social_connection import SocialConnection

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Instagram API endpoints
# ---------------------------------------------------------------------------
INSTAGRAM_AUTH_URL = "https://www.instagram.com/oauth/authorize"
INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
INSTAGRAM_GRAPH_URL = "https://graph.instagram.com"


# ---------------------------------------------------------------------------
# 1. Generate OAuth authorization URL
# ---------------------------------------------------------------------------
def generate_auth_url(state: str) -> str:
    """Build the Instagram OAuth authorization URL.

    Args:
        state: An opaque value (typically the user ID) forwarded to the
               callback so we can associate the token with the right user.

    Returns:
        The fully-formed authorization URL string.
    """
    params = {
        "client_id": settings.INSTAGRAM_APP_ID,
        "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
        "scope": settings.INSTAGRAM_SCOPES,
        "response_type": "code",
        "state": state,
    }
    return f"{INSTAGRAM_AUTH_URL}?{urlencode(params)}"


# ---------------------------------------------------------------------------
# 2. Handle OAuth callback
# ---------------------------------------------------------------------------
async def handle_oauth_callback(
    db: Session,
    code: str,
    state: str,
) -> SocialConnection:
    """Exchange the authorization code for tokens, fetch the user profile,
    and persist a ``SocialConnection`` record.

    Args:
        db: SQLAlchemy database session.
        code: Authorization code returned by Instagram.
        state: The ``state`` value (user ID) we sent in the auth URL.

    Returns:
        The created or updated ``SocialConnection`` instance.

    Raises:
        ValueError: When any step of the OAuth flow fails.
    """
    if not state:
        raise ValueError("Missing OAuth state parameter")

    try:
        user_id = uuid.UUID(state)
    except ValueError:
        raise ValueError("Invalid OAuth state: not a valid user ID")

    # --- Step 1: Exchange code for a short-lived token -----------------
    short_lived_token = await _exchange_code_for_short_token(code)

    # --- Step 2: Exchange short-lived token for a long-lived token -----
    long_lived_data = await _exchange_for_long_lived_token(short_lived_token)
    long_lived_token = long_lived_data["access_token"]
    expires_in = long_lived_data.get("expires_in", 5184000)  # default 60 days

    # --- Step 3: Fetch Instagram user profile --------------------------
    profile = await _fetch_user_profile(long_lived_token)

    # --- Step 4: Create or update the SocialConnection -----------------
    platform_user_id = str(profile["id"])
    username = profile.get("username", "")

    connection = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == user_id,
            SocialConnection.platform == "instagram",
            SocialConnection.platform_user_id == platform_user_id,
        )
        .first()
    )

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    if connection:
        # Update existing connection
        connection.username = username
        connection.display_name = profile.get("name", username)
        connection.profile_image_url = profile.get("profile_picture_url")
        connection.followers_count = profile.get("followers_count", 0)
        connection.access_token_enc = encrypt_token(long_lived_token)
        connection.token_expires_at = token_expires_at
        connection.scopes = settings.INSTAGRAM_SCOPES.split(",")
        connection.status = "active"
        connection.raw_profile_json = profile
    else:
        connection = SocialConnection(
            user_id=user_id,
            platform="instagram",
            platform_user_id=platform_user_id,
            username=username,
            display_name=profile.get("name", username),
            profile_url=f"https://www.instagram.com/{username}/",
            profile_image_url=profile.get("profile_picture_url"),
            followers_count=profile.get("followers_count", 0),
            access_token_enc=encrypt_token(long_lived_token),
            token_expires_at=token_expires_at,
            scopes=settings.INSTAGRAM_SCOPES.split(","),
            status="active",
            raw_profile_json=profile,
            connected_at=datetime.now(timezone.utc),
        )
        db.add(connection)

    db.commit()
    db.refresh(connection)
    return connection


# ---------------------------------------------------------------------------
# 3. Fetch user posts (media) via Graph API
# ---------------------------------------------------------------------------
async def fetch_user_posts(
    access_token: str,
    user_id: str,
    limit: int = 10,
) -> list[dict]:
    """Retrieve recent media items for the given Instagram user.

    Args:
        access_token: A valid (decrypted) long-lived access token.
        user_id: The Instagram user / page ID.
        limit: Maximum number of posts to return (default 10).

    Returns:
        A list of normalised post dictionaries.
    """
    fields = (
        "id,caption,media_type,media_url,thumbnail_url,"
        "permalink,timestamp,like_count,comments_count"
    )
    url = f"{INSTAGRAM_GRAPH_URL}/{user_id}/media"
    params = {
        "fields": fields,
        "limit": limit,
        "access_token": access_token,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)
        if response.status_code != 200:
            logger.error(
                "Instagram fetch_user_posts failed: %s %s",
                response.status_code,
                response.text,
            )
            raise ValueError(
                f"Failed to fetch Instagram posts: {response.status_code}"
            )
        data = response.json()

    posts = data.get("data", [])
    return [_normalize_post(post) for post in posts]


# ---------------------------------------------------------------------------
# 4. Fetch comments for a media item
# ---------------------------------------------------------------------------
async def fetch_post_comments(
    access_token: str,
    media_id: str,
    limit: int = 100,
) -> list[dict]:
    """Retrieve comments (including nested replies) for a given media item.

    Handles cursor-based pagination automatically and returns the full list
    up to the requested *limit*.

    Args:
        access_token: A valid (decrypted) long-lived access token.
        media_id: The Instagram media ID.
        limit: Maximum total comments to collect (default 100).

    Returns:
        A flat list of normalised comment dictionaries.
    """
    fields = (
        "id,text,username,timestamp,like_count,"
        "replies{id,text,username,timestamp,like_count}"
    )
    url = f"{INSTAGRAM_GRAPH_URL}/{media_id}/comments"
    params: dict = {
        "fields": fields,
        "limit": min(limit, 100),  # API max per page
        "access_token": access_token,
    }

    all_comments: list[dict] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        while url and len(all_comments) < limit:
            response = await client.get(url, params=params)
            if response.status_code != 200:
                logger.error(
                    "Instagram fetch_post_comments failed: %s %s",
                    response.status_code,
                    response.text,
                )
                raise ValueError(
                    f"Failed to fetch Instagram comments: {response.status_code}"
                )

            data = response.json()

            for comment in data.get("data", []):
                if len(all_comments) >= limit:
                    break
                all_comments.append(_normalize_comment(comment))

                # Flatten replies into the same list
                replies_data = comment.get("replies", {}).get("data", [])
                for reply in replies_data:
                    if len(all_comments) >= limit:
                        break
                    normalized_reply = _normalize_comment(reply)
                    normalized_reply["parent_id"] = comment["id"]
                    all_comments.append(normalized_reply)

            # Move to next page (if any)
            next_url = data.get("paging", {}).get("next")
            if next_url:
                url = next_url
                params = {}  # params are already embedded in the next URL
            else:
                break

    return all_comments


# ---------------------------------------------------------------------------
# 5. Refresh a long-lived token
# ---------------------------------------------------------------------------
async def refresh_long_lived_token(access_token: str) -> dict:
    """Refresh an existing long-lived Instagram token.

    Long-lived tokens can be refreshed as long as they are at least 24 hours
    old and have not yet expired.

    Args:
        access_token: The current (decrypted) long-lived access token.

    Returns:
        A dict with ``access_token``, ``token_type``, and ``expires_in``.
    """
    url = f"{INSTAGRAM_GRAPH_URL}/refresh_access_token"
    params = {
        "grant_type": "ig_refresh_token",
        "access_token": access_token,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)
        if response.status_code != 200:
            logger.error(
                "Instagram refresh_long_lived_token failed: %s %s",
                response.status_code,
                response.text,
            )
            raise ValueError(
                f"Failed to refresh Instagram token: {response.status_code}"
            )
        data = response.json()

    return {
        "access_token": data["access_token"],
        "token_type": data.get("token_type", "bearer"),
        "expires_in": data.get("expires_in", 5184000),
    }


# ===========================================================================
# Internal helpers
# ===========================================================================

async def _exchange_code_for_short_token(code: str) -> str:
    """POST to Instagram to exchange the authorization code for a short-lived
    access token."""
    payload = {
        "client_id": settings.INSTAGRAM_APP_ID,
        "client_secret": settings.INSTAGRAM_APP_SECRET,
        "grant_type": "authorization_code",
        "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
        "code": code,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(INSTAGRAM_TOKEN_URL, data=payload)
        if response.status_code != 200:
            logger.error(
                "Instagram code exchange failed: %s %s",
                response.status_code,
                response.text,
            )
            raise ValueError(
                f"Failed to exchange Instagram authorization code: "
                f"{response.status_code} - {response.text}"
            )
        data = response.json()

    token = data.get("access_token")
    if not token:
        raise ValueError("No access_token in Instagram token response")
    return token


async def _exchange_for_long_lived_token(short_lived_token: str) -> dict:
    """Exchange a short-lived token for a long-lived one (valid ~60 days)."""
    url = f"{INSTAGRAM_GRAPH_URL}/access_token"
    params = {
        "grant_type": "ig_exchange_token",
        "client_secret": settings.INSTAGRAM_APP_SECRET,
        "access_token": short_lived_token,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)
        if response.status_code != 200:
            logger.error(
                "Instagram long-lived token exchange failed: %s %s",
                response.status_code,
                response.text,
            )
            raise ValueError(
                f"Failed to obtain long-lived Instagram token: "
                f"{response.status_code} - {response.text}"
            )
        data = response.json()

    if "access_token" not in data:
        raise ValueError("No access_token in long-lived token response")
    return data


async def _fetch_user_profile(access_token: str) -> dict:
    """GET the authenticated user's Instagram profile."""
    fields = (
        "id,username,name,account_type,profile_picture_url,"
        "followers_count,follows_count,media_count"
    )
    url = f"{INSTAGRAM_GRAPH_URL}/me"
    params = {
        "fields": fields,
        "access_token": access_token,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)
        if response.status_code != 200:
            logger.error(
                "Instagram profile fetch failed: %s %s",
                response.status_code,
                response.text,
            )
            raise ValueError(
                f"Failed to fetch Instagram profile: "
                f"{response.status_code} - {response.text}"
            )
        return response.json()


def _normalize_post(raw: dict) -> dict:
    """Transform a raw Instagram media object into a consistent dict."""
    return {
        "platform_post_id": raw.get("id"),
        "caption": raw.get("caption", ""),
        "media_type": raw.get("media_type"),
        "media_url": raw.get("media_url"),
        "thumbnail_url": raw.get("thumbnail_url"),
        "permalink": raw.get("permalink"),
        "timestamp": raw.get("timestamp"),
        "like_count": raw.get("like_count", 0),
        "comments_count": raw.get("comments_count", 0),
    }


def _normalize_comment(raw: dict) -> dict:
    """Transform a raw Instagram comment object into a consistent dict."""
    return {
        "platform_comment_id": raw.get("id"),
        "text": raw.get("text", ""),
        "username": raw.get("username", ""),
        "timestamp": raw.get("timestamp"),
        "like_count": raw.get("like_count", 0),
        "parent_id": None,
    }
