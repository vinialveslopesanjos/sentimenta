import logging
import secrets
import uuid
from datetime import date, datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.cache import get_redis
from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.social_connection import SocialConnection
from app.models.user import User
from app.schemas.connection import (
    ConnectionResponse,
    ConnectionUpdateRequest,
    OAuthURLResponse,
    SyncResponse,
    YouTubeConnectRequest,
)

logger = logging.getLogger(__name__)


class SyncRequest(BaseModel):
    max_posts: int = Field(10, ge=1, le=200)
    max_comments_per_post: int = Field(100, ge=10, le=1000)
    since_date: Optional[date] = None

router = APIRouter(prefix="/connections", tags=["connections"])

from app.services.xpoz_service import get_instagram_profile

@router.get("/check-profile")
def check_profile(
    platform: str,
    username: str,
    current_user: User = Depends(get_current_user)
):
    if platform.lower() != "instagram":
        raise HTTPException(status_code=400, detail="Apenas a plataforma Instagram possui verificação rápida atualmente.")
    
    prof = get_instagram_profile(username)
    if not prof:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")
    
    # Cast counters from string
    def safe_int(val):
        try:
            return int(val)
        except:
            return 0

    return {
        "platform_user_id": prof.get("id"),
        "username": prof.get("username", username),
        "fullName": prof.get("fullName"),
        "biography": prof.get("biography"),
        "followers_count": safe_int(prof.get("followerCount")),
        "following_count": safe_int(prof.get("followingCount")),
        "media_count": safe_int(prof.get("mediaCount")),
        "is_private": prof.get("isPrivate", "false").lower() == "true",
        "is_verified": prof.get("isVerified", "false").lower() == "true",
        "profile_pic_url": prof.get("profilePicUrl")
    }


# --- Instagram (Public Scraping) ---
@router.post("/instagram", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def connect_instagram_public(
    data: YouTubeConnectRequest,  # Reuse schema (just needs username)
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Connect Instagram via public scraping (no OAuth needed)."""
    from app.services.instagram_scrape_service import create_instagram_connection
    from app.services.plan_service import enforce_connection_limit, PlanLimitError

    username = data.channel_handle.strip()
    if username.startswith("@"):
        username = username[1:]

    # Check if already connected
    existing = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == current_user.id,
            SocialConnection.platform == "instagram",
            SocialConnection.username == username,
        )
        .first()
    )
    if existing:
        return existing

    # Enforce plan connection limit
    try:
        enforce_connection_limit(db, current_user, "instagram")
    except PlanLimitError as e:
        raise HTTPException(status_code=403, detail=e.message)

    connection = create_instagram_connection(db, str(current_user.id), username)
    if not connection:
        raise HTTPException(
            status_code=404,
            detail="Instagram profile not found or is private. Only public profiles can be analyzed.",
        )

    return connection


# --- YouTube ---
@router.post("/youtube", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def connect_youtube(
    data: YouTubeConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.youtube_service import discover_channel_info

    channel_handle = data.channel_handle.strip()
    if not channel_handle.startswith("@"):
        channel_handle = f"@{channel_handle}"

    # Check if already connected
    existing = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == current_user.id,
            SocialConnection.platform == "youtube",
            SocialConnection.username == channel_handle,
        )
        .first()
    )
    if existing:
        return existing

    # Enforce plan connection limit
    from app.services.plan_service import enforce_connection_limit, PlanLimitError
    try:
        enforce_connection_limit(db, current_user, "youtube")
    except PlanLimitError as e:
        raise HTTPException(status_code=403, detail=e.message)

    # Discover channel info via yt-dlp
    info = discover_channel_info(channel_handle)
    if not info:
        raise HTTPException(status_code=404, detail="Channel not found")

    conn = SocialConnection(
        user_id=current_user.id,
        platform="youtube",
        platform_user_id=info.get("channel_id"),
        username=channel_handle,
        display_name=info.get("channel_title", channel_handle),
        profile_url=f"https://youtube.com/{channel_handle}",
        status="active",
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


# --- Twitter ---
@router.post("/twitter", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def connect_twitter(
    data: YouTubeConnectRequest,  # reuses same {channel_handle} schema
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Connect a Twitter/X profile via XPoz public scraping."""
    from app.services.twitter_service import create_twitter_connection
    from app.services.plan_service import enforce_connection_limit, PlanLimitError

    username = data.channel_handle.strip().lstrip("@")

    # Check if already connected
    existing = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == current_user.id,
            SocialConnection.platform == "twitter",
            SocialConnection.username == username,
        )
        .first()
    )
    if existing:
        return existing

    # Enforce plan limit
    try:
        enforce_connection_limit(db, current_user, "twitter")
    except PlanLimitError as e:
        raise HTTPException(status_code=403, detail=e.message)

    connection = create_twitter_connection(db, str(current_user.id), username)
    if not connection:
        raise HTTPException(
            status_code=404,
            detail="Twitter profile not found. Make sure the username is correct.",
        )
    return connection

@router.get("", response_model=list[ConnectionResponse])
def list_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    connections = (
        db.query(SocialConnection)
        .filter(SocialConnection.user_id == current_user.id)
        .order_by(SocialConnection.connected_at.desc())
        .all()
    )
    return connections


@router.get("/{connection_id}", response_model=ConnectionResponse)
def get_connection(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.id == connection_id,
            SocialConnection.user_id == current_user.id,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn

@router.patch("/{connection_id}", response_model=ConnectionResponse)
def update_connection(
    connection_id: uuid.UUID,
    params: ConnectionUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.id == connection_id,
            SocialConnection.user_id == current_user.id,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    if params.persona is not None:
        conn.persona = params.persona
        
    if params.ignore_author_comments is not None:
        conn.ignore_author_comments = params.ignore_author_comments
        
    db.commit()
    db.refresh(conn)
    return conn


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.id == connection_id,
            SocialConnection.user_id == current_user.id,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()





# --- Instagram OAuth (for already-authenticated users) ---
@router.get("/instagram/auth-url", response_model=OAuthURLResponse)
def get_instagram_auth_url(current_user: User = Depends(get_current_user)):
    from app.services.instagram_service import generate_auth_url

    auth_url = generate_auth_url(
        state=str(current_user.id),
        redirect_uri=settings.INSTAGRAM_CONNECTIONS_REDIRECT_URI,
    )
    return OAuthURLResponse(auth_url=auth_url)


@router.get("/instagram/callback")
async def instagram_callback(
    code: str = Query(None),
    state: str = Query(""),
    error: str = Query(None),
    error_reason: str = Query(None),
    error_description: str = Query(None),
    db: Session = Depends(get_db),
):
    base_url = settings.APP_URL.rstrip("/")

    if error:
        logger.error("Instagram OAuth connection error: %s - %s - %s", error, error_reason, error_description)
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=instagram&error={error_description or error}"
        )

    if not code:
        logger.error("Instagram callback received without code parameter")
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=instagram&error=missing_code"
        )

    from app.services.instagram_service import handle_oauth_callback

    try:
        logger.info("Instagram OAuth connection callback - state: %s", state)
        connection = await handle_oauth_callback(db, code, state)
        logger.info("Instagram connection created: %s", connection.id)
    except ValueError as e:
        logger.error("Instagram OAuth connection callback failed: %s", e)
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=instagram&error={str(e)}"
        )

    return RedirectResponse(url=f"{base_url}/settings?tab=integrations&status=success&platform=instagram")


# --- TikTok OAuth (for already-authenticated users) ---
@router.get("/tiktok/auth-url", response_model=OAuthURLResponse)
def get_tiktok_auth_url(current_user: User = Depends(get_current_user)):
    from app.services.tiktok_service import generate_auth_url

    r = get_redis()
    if not r:
        raise HTTPException(status_code=503, detail="Redis unavailable")

    state = secrets.token_urlsafe(32)
    auth_url, code_verifier = generate_auth_url(
        state=state,
        redirect_uri=settings.TIKTOK_CONNECTIONS_REDIRECT_URI,
    )

    # Store user_id + code_verifier keyed by state
    r.setex(f"oauth_conn_state:{state}", 600, f"{current_user.id}:{code_verifier}")

    return OAuthURLResponse(auth_url=auth_url)


@router.get("/tiktok/callback")
async def tiktok_connection_callback(
    code: str = Query(None),
    state: str = Query(""),
    error: str = Query(None),
    error_description: str = Query(None),
    db: Session = Depends(get_db),
):
    base_url = settings.APP_URL.rstrip("/")

    if error:
        logger.error("TikTok OAuth connection error: %s - %s", error, error_description)
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=tiktok&error={error_description or error}"
        )

    if not code:
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=tiktok&error=missing_code"
        )

    r = get_redis()
    if not r:
        return RedirectResponse(url=f"{base_url}/settings?tab=integrations&status=error&platform=tiktok&error=server_error")

    stored = r.get(f"oauth_conn_state:{state}")
    if not stored or ":" not in stored:
        logger.error("TikTok OAuth connection: invalid state %s", state)
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=tiktok&error=invalid_state"
        )
    r.delete(f"oauth_conn_state:{state}")

    # Parse user_id and code_verifier
    parts = stored.split(":", 1)
    user_id_str = parts[0]
    code_verifier = parts[1]

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=tiktok&error=invalid_state"
        )

    try:
        from app.services.tiktok_service import exchange_code_for_tokens, fetch_user_profile
        from app.core.security import encrypt_token

        token_data = await exchange_code_for_tokens(
            code, code_verifier, redirect_uri=settings.TIKTOK_CONNECTIONS_REDIRECT_URI
        )
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 86400)
        open_id = token_data.get("open_id") or ""

        profile = await fetch_user_profile(access_token)
        username = profile.get("username", f"tiktok_{open_id[:8]}")

        # Check if already connected
        existing = (
            db.query(SocialConnection)
            .filter(
                SocialConnection.user_id == user_uuid,
                SocialConnection.platform == "tiktok",
                SocialConnection.platform_user_id == open_id,
            )
            .first()
        )

        token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        if existing:
            existing.access_token_enc = encrypt_token(access_token)
            if refresh_token:
                existing.refresh_token_enc = encrypt_token(refresh_token)
            existing.token_expires_at = token_expires_at
            existing.username = username
            existing.display_name = profile.get("display_name", username)
            existing.profile_image_url = profile.get("avatar_url")
            existing.followers_count = profile.get("follower_count", 0)
            existing.status = "active"
            existing.raw_profile_json = profile
        else:
            conn = SocialConnection(
                user_id=user_uuid,
                platform="tiktok",
                platform_user_id=open_id,
                username=username,
                display_name=profile.get("display_name", username),
                profile_url=f"https://www.tiktok.com/@{username}" if username else None,
                profile_image_url=profile.get("avatar_url"),
                followers_count=profile.get("follower_count", 0),
                access_token_enc=encrypt_token(access_token),
                refresh_token_enc=encrypt_token(refresh_token) if refresh_token else None,
                token_expires_at=token_expires_at,
                scopes=["user.info.basic", "user.info.profile", "video.list"],
                status="active",
                raw_profile_json=profile,
                connected_at=datetime.now(timezone.utc),
            )
            db.add(conn)

        db.commit()
        logger.info("TikTok connection created for user %s", user_id_str)

    except ValueError as e:
        logger.error("TikTok OAuth connection callback failed: %s", e)
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=tiktok&error={str(e)}"
        )

    return RedirectResponse(url=f"{base_url}/settings?tab=integrations&status=success&platform=tiktok")


# --- Sync ---
@router.post("/{connection_id}/sync", response_model=SyncResponse)
def trigger_sync(
    connection_id: uuid.UUID,
    body: Optional[SyncRequest] = Body(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.middleware.rate_limiter import rate_limiter
    from app.services.plan_service import enforce_sync_limits, PlanLimitError

    # Rate limit: 1 sync per connection per 5 minutes
    rate_limiter.check(f"sync:{connection_id}", max_requests=1, window_seconds=300)

    # Enforce plan limits (syncs/month, Apify budget)
    try:
        plan_limits = enforce_sync_limits(db, current_user)
    except PlanLimitError as e:
        raise HTTPException(status_code=403, detail=e.message)

    conn = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.id == connection_id,
            SocialConnection.user_id == current_user.id,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    params = body or SyncRequest()
    since_date_str = str(params.since_date) if params.since_date else None

    # Cap params to plan limits (user can't exceed their plan tier)
    effective_max_posts = min(params.max_posts, plan_limits["max_posts"])
    effective_max_comments = min(
        params.max_comments_per_post, plan_limits["max_comments_per_post"]
    )

    from app.tasks.pipeline_tasks import task_full_pipeline

    result = task_full_pipeline.delay(
        str(connection_id),
        str(current_user.id),
        max_posts=effective_max_posts,
        max_comments_per_post=effective_max_comments,
        since_date=since_date_str,
    )

    return SyncResponse(
        connection_id=connection_id,
        task_id=result.id,
        message=f"Sync started for {conn.platform}:{conn.username}",
    )
