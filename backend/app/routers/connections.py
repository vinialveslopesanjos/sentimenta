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
    max_comments_per_post: int = Field(100, ge=10, le=10000)
    since_date: Optional[date] = None
    use_apify_comments: bool = True
    comment_sample_mode: str = Field("all", pattern=r"^(all|sample)$")

router = APIRouter(prefix="/connections", tags=["connections"])

@router.get("/check-profile")
def check_profile(
    platform: str,
    username: str,
    current_user: User = Depends(get_current_user)
):
    if platform.lower() != "instagram":
        raise HTTPException(status_code=400, detail="Apenas a plataforma Instagram possui verificação rápida atualmente.")

    from app.services.apify_service import fetch_profile_apify
    prof = fetch_profile_apify(username)
    if not prof:
        raise HTTPException(status_code=404, detail="Perfil não encontrado ou é privado.")

    return {
        "platform_user_id": prof.get("id"),
        "username": prof.get("username", username),
        "fullName": prof.get("fullName"),
        "biography": prof.get("biography"),
        "followers_count": prof.get("followersCount", 0),
        "following_count": prof.get("followsCount", 0),
        "media_count": prof.get("postsCount", 0),
        "is_private": prof.get("private", False),
        "is_verified": prof.get("verified", False),
        "profile_pic_url": prof.get("profilePicUrlHD") or prof.get("profilePicUrl"),
    }


# --- Instagram (Public Scraping) ---
@router.post("/instagram", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def connect_instagram_public(
    data: YouTubeConnectRequest,  # Reuse schema (just needs username)
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Connect Instagram via public scraping (no OAuth needed)."""
    from app.services.instagram_connection_service import create_instagram_connection
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

    # Copy user persona to connection for LLM context
    if current_user.onboarding_data and current_user.onboarding_data.get("description"):
        connection.persona = current_user.onboarding_data["description"]
        db.commit()

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

    # Discover channel info via YouTube Data API v3 (with yt-dlp fallback)
    info = discover_channel_info(channel_handle)
    if not info:
        raise HTTPException(status_code=404, detail="Channel not found")

    conn = SocialConnection(
        user_id=current_user.id,
        platform="youtube",
        platform_user_id=info.get("channel_id"),
        username=channel_handle,
        display_name=info.get("channel_title") or info.get("title", channel_handle),
        profile_url=f"https://youtube.com/{channel_handle}",
        profile_image_url=info.get("thumbnail_url"),
        followers_count=info.get("subscriber_count", 0),
        status="active",
    )
    # Copy user persona to connection for LLM context
    if current_user.onboarding_data and current_user.onboarding_data.get("description"):
        conn.persona = current_user.onboarding_data["description"]
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
    """Connect a Twitter/X profile via public scraping."""
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

    # Copy user persona to connection for LLM context
    if current_user.onboarding_data and current_user.onboarding_data.get("description"):
        connection.persona = current_user.onboarding_data["description"]
        db.commit()

    return connection

# --- TikTok (by username, no OAuth) ---
@router.post("/tiktok", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def connect_tiktok_public(
    data: YouTubeConnectRequest,  # reuses same {channel_handle} schema
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Connect a TikTok profile by username (public scraping via Apify, no OAuth needed)."""
    from app.services.plan_service import enforce_connection_limit, PlanLimitError

    username = data.channel_handle.strip().lstrip("@")

    # Check if already connected
    existing = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == current_user.id,
            SocialConnection.platform == "tiktok",
            SocialConnection.username == username,
        )
        .first()
    )
    if existing:
        return existing

    # Enforce plan limit
    try:
        enforce_connection_limit(db, current_user, "tiktok")
    except PlanLimitError as e:
        raise HTTPException(status_code=403, detail=e.message)

    # Create connection directly (Apify scraping doesn't need profile discovery)
    conn = SocialConnection(
        user_id=current_user.id,
        platform="tiktok",
        platform_user_id=None,
        username=username,
        display_name=username,
        profile_url=f"https://www.tiktok.com/@{username}",
        status="active",
        connected_at=datetime.now(timezone.utc),
    )
    # Copy user persona to connection for LLM context
    if current_user.onboarding_data and current_user.onboarding_data.get("description"):
        conn.persona = current_user.onboarding_data["description"]
    db.add(conn)
    db.commit()
    db.refresh(conn)
    logger.info("TikTok connection created for @%s (user %s)", username, current_user.id)
    return conn


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

    if params.auto_sync is not None:
        conn.auto_sync = params.auto_sync

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
    r = get_redis()
    if not r:
        raise HTTPException(status_code=503, detail="Redis unavailable")

    state = secrets.token_urlsafe(32)
    r.setex(f"oauth_conn_state:{state}", 600, f"instagram:{current_user.id}")
    auth_url = generate_auth_url(
        state=state,
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

    r = get_redis()
    if not r:
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=instagram&error=server_error"
        )
    stored = r.get(f"oauth_conn_state:{state}")
    if not stored or not str(stored).startswith("instagram:"):
        logger.error("Instagram OAuth connection: invalid state %s", state)
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=instagram&error=invalid_state"
        )
    r.delete(f"oauth_conn_state:{state}")

    user_id_str = str(stored).split(":", 1)[1]
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=instagram&error=invalid_state"
        )

    try:
        logger.info("Instagram OAuth connection callback - state: %s", state)
        connection = await handle_oauth_callback(db, code, user_id)
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
            # Copy user persona to connection for LLM context
            user_obj = db.get(User, user_uuid)
            if user_obj and user_obj.onboarding_data and user_obj.onboarding_data.get("description"):
                conn.persona = user_obj.onboarding_data["description"]
            db.add(conn)

        db.commit()
        logger.info("TikTok connection created for user %s", user_id_str)

    except ValueError as e:
        logger.error("TikTok OAuth connection callback failed: %s", e)
        return RedirectResponse(
            url=f"{base_url}/settings?tab=integrations&status=error&platform=tiktok&error={str(e)}"
        )

    return RedirectResponse(url=f"{base_url}/settings?tab=integrations&status=success&platform=tiktok")


# --- Preflight ---
class PreflightBlocker(BaseModel):
    code: str
    message: str

class PreflightWarning(BaseModel):
    code: str
    message: str

class PreflightResponse(BaseModel):
    can_sync: bool
    blockers: list[PreflightBlocker]
    warnings: list[PreflightWarning]
    credits_available: int
    estimated_credits_comments: int
    estimated_credits_demographics: int
    estimated_credits_total: int
    estimated_cost_brl: float
    eta_min: int
    eta_max: int
    persona_set: bool
    context_readiness_mode: str  # "known" | "estimated"
    known_posts_with_context: int
    known_posts_missing_context: int
    is_first_run: bool


@router.get("/{connection_id}/sync/preflight", response_model=PreflightResponse)
def sync_preflight(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pre-sync check: returns blockers, warnings, cost/credit estimates."""
    from app.services.plan_service import (
        get_plan_limits,
        count_syncs_this_month,
        get_apify_spend_this_month,
        estimate_sync_cost_brl,
        get_platform_costs,
    )
    from app.services.credit_service import get_or_create_balance
    from app.models.pipeline_run import PipelineRun
    from app.models.post import Post

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

    blockers: list[dict] = []
    warnings: list[dict] = []
    limits = get_plan_limits(current_user.plan)

    # --- Persona check ---
    persona_set = bool(conn.persona and conn.persona.strip())
    if not persona_set:
        blockers.append({
            "code": "missing_persona",
            "message": "Defina a persona da conexão antes de sincronizar.",
        })

    # --- Credits check ---
    bal = get_or_create_balance(db, current_user.id)
    credits_available = bal.plan_credits + bal.pack_credits

    if credits_available <= 0:
        blockers.append({
            "code": "insufficient_credits",
            "message": "Créditos insuficientes para iniciar sync.",
        })
    elif credits_available < limits["credits_per_month"] * 0.1:
        warnings.append({
            "code": "low_credits",
            "message": f"Você tem apenas {credits_available} créditos restantes.",
        })

    # --- Budget guardrail ---
    apify_spent = get_apify_spend_this_month(db, current_user.id)
    if apify_spent >= limits.get("apify_budget_brl", 999999):
        blockers.append({
            "code": "budget_guardrail",
            "message": "Orçamento de coleta do mês atingido.",
        })

    # --- Syncs per month ---
    syncs_used = count_syncs_this_month(db, current_user.id)
    if syncs_used >= limits["syncs_per_month"]:
        blockers.append({
            "code": "budget_guardrail",
            "message": f"Limite de syncs atingido ({syncs_used}/{limits['syncs_per_month']}).",
        })

    # --- Already running ---
    active_run = db.query(PipelineRun).filter(
        PipelineRun.connection_id == connection_id,
        PipelineRun.status == "running",
    ).first()
    if active_run:
        blockers.append({
            "code": "already_running",
            "message": "Já existe um sync em andamento para esta conexão.",
        })

    # --- Is first run ---
    any_completed = db.query(PipelineRun).filter(
        PipelineRun.connection_id == connection_id,
        PipelineRun.status.in_(["completed", "partial"]),
    ).first()
    is_first_run = any_completed is None

    # --- Post context readiness ---
    existing_posts = (
        db.query(Post)
        .filter(Post.connection_id == connection_id)
        .all()
    )

    if not existing_posts:
        context_readiness_mode = "estimated"
        known_posts_with_context = 0
        known_posts_missing_context = 0
    else:
        context_readiness_mode = "known"
        known_posts_with_context = 0
        known_posts_missing_context = 0
        for p in existing_posts:
            has_caption = bool(p.content_text and len(p.content_text) > 10)
            has_image_ctx = bool(p.image_context)
            if has_caption or has_image_ctx:
                known_posts_with_context += 1
            else:
                known_posts_missing_context += 1

        if known_posts_missing_context > 0:
            warnings.append({
                "code": "posts_missing_context",
                "message": f"{known_posts_missing_context} post(s) podem ser ignorados por falta de contexto.",
            })

    # --- Cost estimates ---
    max_posts = limits["max_posts_per_sync"]
    max_comments = limits["max_comments_per_post"]
    has_demographics = limits.get("demographics", False)

    cost_result = estimate_sync_cost_brl(
        num_posts=max_posts,
        avg_comments_per_post=max_comments,
        platform=conn.platform,
        include_demographics=has_demographics,
        is_first_run=is_first_run,
    )

    estimated_credits_comments = max_posts * max_comments  # 1 credit per comment
    estimated_credits_demographics = 0
    if has_demographics:
        from app.services.credit_service import DEMOGRAPHIC_CREDIT_COST
        unique_authors = int(estimated_credits_comments * 0.6)
        estimated_credits_demographics = unique_authors * DEMOGRAPHIC_CREDIT_COST

    estimated_credits_total = estimated_credits_comments + estimated_credits_demographics

    if cost_result["estimated_cost_brl"] > limits.get("apify_budget_brl", 999999) * 0.5:
        warnings.append({
            "code": "high_estimated_cost",
            "message": f"Custo estimado alto: R${cost_result['estimated_cost_brl']:.2f}.",
        })

    # --- ETA ---
    # Rough: 2s per post for scraping + 1s per 50 comments for LLM
    total_comments_est = max_posts * max_comments
    eta_min = max(1, (max_posts * 2 + total_comments_est // 50) // 60)
    eta_max = max(eta_min + 1, eta_min * 2)

    can_sync = len(blockers) == 0

    return PreflightResponse(
        can_sync=can_sync,
        blockers=blockers,
        warnings=warnings,
        credits_available=credits_available,
        estimated_credits_comments=estimated_credits_comments,
        estimated_credits_demographics=estimated_credits_demographics,
        estimated_credits_total=estimated_credits_total,
        estimated_cost_brl=cost_result["estimated_cost_brl"],
        eta_min=eta_min,
        eta_max=eta_max,
        persona_set=persona_set,
        context_readiness_mode=context_readiness_mode,
        known_posts_with_context=known_posts_with_context,
        known_posts_missing_context=known_posts_missing_context,
        is_first_run=is_first_run,
    )


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
    from app.models.pipeline_run import PipelineRun

    # Rate limit: 1 sync per connection per 5 minutes
    rate_limiter.check(f"sync:{connection_id}", max_requests=1, window_seconds=300)

    # Block if sync already running for this connection
    active_run = db.query(PipelineRun).filter(
        PipelineRun.connection_id == str(connection_id),
        PipelineRun.status == "running",
    ).first()
    if active_run:
        raise HTTPException(status_code=409, detail="Sync already running for this connection")

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

    # When using Apify comments, allow higher comment cap (Apify handles large volumes)
    if params.use_apify_comments:
        effective_max_comments = min(10000, plan_limits.get("max_comments_per_post", 10000))

    # Create PipelineRun in router so we can return the real run_id
    run = PipelineRun(
        user_id=current_user.id,
        connection_id=connection_id,
        run_type="full",
        status="running",
        target_posts=effective_max_posts,
    )
    db.add(run)
    db.commit()

    from app.tasks.pipeline_tasks import task_full_pipeline

    result = task_full_pipeline.delay(
        str(connection_id),
        str(current_user.id),
        max_posts=effective_max_posts,
        max_comments_per_post=effective_max_comments,
        since_date=since_date_str,
        use_apify_comments=params.use_apify_comments,
        comment_sample_mode=params.comment_sample_mode,
        run_id=str(run.id),
    )

    # Store celery task id on the run
    run.celery_task_id = result.id
    db.commit()

    return SyncResponse(
        connection_id=connection_id,
        task_id=str(run.id),
        run_id=str(run.id),
        message=f"Sync started for {conn.platform}:{conn.username}",
    )


@router.post("/{connection_id}/analyze", response_model=SyncResponse)
def trigger_analyze(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyze-only: run sentiment analysis on existing pending comments (no ingestion)."""
    from app.middleware.rate_limiter import rate_limiter
    from app.models.pipeline_run import PipelineRun

    # Rate limit: 1 analyze per connection per 5 minutes
    rate_limiter.check(f"analyze:{connection_id}", max_requests=1, window_seconds=300)

    # Block if sync/analyze already running for this connection
    active_run = db.query(PipelineRun).filter(
        PipelineRun.connection_id == str(connection_id),
        PipelineRun.status == "running",
    ).first()
    if active_run:
        raise HTTPException(status_code=409, detail="Sync or analysis already running for this connection")

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

    # Guardrail: check credits before allowing analysis (ADR-013)
    from app.services.credit_service import has_enough
    if not has_enough(db, current_user.id, 1):
        raise HTTPException(
            status_code=403,
            detail="Créditos insuficientes para iniciar análise. Faça upgrade ou compre créditos extras.",
        )

    from app.tasks.pipeline_tasks import task_analyze_connection

    # Create PipelineRun before dispatch (same pattern as sync)
    run = PipelineRun(
        user_id=current_user.id,
        connection_id=connection_id,
        run_type="analyze",
        status="running",
    )
    db.add(run)
    db.commit()

    result = task_analyze_connection.delay(
        str(connection_id),
        str(current_user.id),
        run_id=str(run.id),
    )

    # Store celery task id on the run
    run.celery_task_id = result.id
    db.commit()

    return SyncResponse(
        connection_id=connection_id,
        task_id=str(run.id),
        run_id=str(run.id),
        message=f"Analysis started for {conn.platform}:{conn.username}",
    )
