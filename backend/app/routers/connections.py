import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.social_connection import SocialConnection
from app.models.user import User
from app.schemas.connection import (
    ConnectionResponse,
    OAuthURLResponse,
    SyncResponse,
    YouTubeConnectRequest,
)


class SyncRequest(BaseModel):
    max_posts: int = Field(10, ge=1, le=200)
    max_comments_per_post: int = Field(100, ge=10, le=1000)
    since_date: Optional[date] = None

router = APIRouter(prefix="/connections", tags=["connections"])


@router.get("/", response_model=list[ConnectionResponse])
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


# --- Instagram (Public Scraping) ---
@router.post("/instagram", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def connect_instagram_public(
    data: YouTubeConnectRequest,  # Reuse schema (just needs username)
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Connect Instagram via public scraping (no OAuth needed)."""
    from app.services.instagram_scrape_service import create_instagram_connection

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


# --- Instagram OAuth ---
@router.get("/instagram/auth-url", response_model=OAuthURLResponse)
def get_instagram_auth_url(current_user: User = Depends(get_current_user)):
    from app.services.instagram_service import generate_auth_url

    auth_url = generate_auth_url(state=str(current_user.id))
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
    import logging
    logger = logging.getLogger(__name__)

    # Check for OAuth errors first
    if error:
        logger.error(f"Instagram OAuth error: {error} - {error_reason} - {error_description}")
        return RedirectResponse(
            url=f"http://localhost:3000/connect?status=error&platform=instagram&error={error_description or error}"
        )

    if not code:
        logger.error("Instagram callback received without code parameter")
        return RedirectResponse(
            url=f"http://localhost:3000/connect?status=error&platform=instagram&error=missing_code"
        )

    from app.services.instagram_service import handle_oauth_callback

    try:
        logger.info(f"Instagram OAuth callback - code: {code[:20]}..., state: {state}")
        connection = await handle_oauth_callback(db, code, state)
        logger.info(f"Instagram connection created: {connection.id}")
    except ValueError as e:
        logger.error(f"Instagram OAuth callback failed: {e}")
        return RedirectResponse(
            url=f"http://localhost:3000/connect?status=error&platform=instagram&error={str(e)}"
        )

    # Redirect to frontend with success
    return RedirectResponse(url=f"http://localhost:3000/connect?status=success&platform=instagram")


# --- Sync ---
@router.post("/{connection_id}/sync", response_model=SyncResponse)
def trigger_sync(
    connection_id: uuid.UUID,
    body: Optional[SyncRequest] = Body(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.middleware.rate_limiter import rate_limiter

    # Rate limit: 1 sync per connection per 5 minutes
    rate_limiter.check(f"sync:{connection_id}", max_requests=1, window_seconds=300)

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

    from app.tasks.pipeline_tasks import task_full_pipeline

    result = task_full_pipeline.delay(
        str(connection_id),
        str(current_user.id),
        max_posts=params.max_posts,
        max_comments_per_post=params.max_comments_per_post,
        since_date=since_date_str,
    )

    return SyncResponse(
        connection_id=connection_id,
        task_id=result.id,
        message=f"Sync started for {conn.platform}:{conn.username}",
    )
