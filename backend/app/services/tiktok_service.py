"""
TikTok OAuth service: Login Kit v2 with PKCE.
"""

import hashlib
import base64
import logging
import secrets
from urllib.parse import urlencode

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
TIKTOK_USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/"


def generate_auth_url(state: str, redirect_uri: str | None = None) -> tuple[str, str]:
    """Build the TikTok OAuth authorization URL with PKCE.

    Returns:
        (auth_url, code_verifier) — the verifier must be stored server-side.
    """
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest())
        .rstrip(b"=")
        .decode()
    )

    params = {
        "client_key": settings.TIKTOK_CLIENT_KEY,
        "redirect_uri": redirect_uri or settings.TIKTOK_REDIRECT_URI,
        "scope": "user.info.basic,user.info.profile,video.list",
        "response_type": "code",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    auth_url = f"{TIKTOK_AUTH_URL}?{urlencode(params)}"
    return auth_url, code_verifier


async def exchange_code_for_tokens(
    code: str,
    code_verifier: str,
    redirect_uri: str | None = None,
) -> dict:
    """Exchange authorization code + PKCE verifier for access/refresh tokens."""
    payload = {
        "client_key": settings.TIKTOK_CLIENT_KEY,
        "client_secret": settings.TIKTOK_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri or settings.TIKTOK_REDIRECT_URI,
        "code_verifier": code_verifier,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            TIKTOK_TOKEN_URL,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code != 200:
            logger.error("TikTok token exchange failed: %s %s", response.status_code, response.text)
            raise ValueError(f"TikTok token exchange failed: {response.status_code}")
        data = response.json()

    if "access_token" not in data:
        error_desc = data.get("error_description", data.get("error", "unknown"))
        raise ValueError(f"TikTok token exchange error: {error_desc}")

    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_in": data.get("expires_in", 86400),
        "open_id": data.get("open_id"),
        "scope": data.get("scope"),
        "token_type": data.get("token_type", "Bearer"),
    }


async def fetch_user_profile(access_token: str) -> dict:
    """Fetch TikTok user profile info."""
    params = {
        "fields": "open_id,union_id,avatar_url,display_name,username,follower_count,following_count,video_count",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            TIKTOK_USERINFO_URL,
            params=params,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if response.status_code != 200:
            logger.error("TikTok profile fetch failed: %s %s", response.status_code, response.text)
            raise ValueError(f"TikTok profile fetch failed: {response.status_code}")
        data = response.json()

    user_data = data.get("data", {}).get("user", {})
    if not user_data:
        raise ValueError("TikTok returned empty user profile")

    return user_data


async def refresh_access_token(refresh_token: str) -> dict:
    """Refresh a TikTok access token using the refresh token."""
    payload = {
        "client_key": settings.TIKTOK_CLIENT_KEY,
        "client_secret": settings.TIKTOK_CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            TIKTOK_TOKEN_URL,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code != 200:
            logger.error("TikTok token refresh failed: %s %s", response.status_code, response.text)
            raise ValueError(f"TikTok token refresh failed: {response.status_code}")
        data = response.json()

    if "access_token" not in data:
        error_desc = data.get("error_description", data.get("error", "unknown"))
        raise ValueError(f"TikTok token refresh error: {error_desc}")

    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_in": data.get("expires_in", 86400),
        "open_id": data.get("open_id"),
        "scope": data.get("scope"),
    }
