import logging
import secrets
import uuid as _uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.cache import get_redis
from app.core.config import settings
from app.core.deps import get_current_user, get_current_user_unverified
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    GoogleLogin,
    TokenRefresh,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)
from app.services.auth_service import (
    authenticate_google,
    authenticate_user,
    create_tokens,
    refresh_access_token,
    register_user,
)
from app.services.email_service import send_verification_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    try:
        user = register_user(db, data.email, data.password, data.name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    # Generate verification token and send email
    try:
        token = str(_uuid.uuid4())
        user.email_verification_token = token
        user.email_verification_sent_at = datetime.now(timezone.utc)
        db.add(user)
        db.commit()

        verification_url = f"{settings.APP_URL}/verify-email?token={token}"
        send_verification_email(user.email, user.name, verification_url)
    except Exception as exc:
        logger.error("Failed to send verification email on register: %s", exc)

    return create_tokens(user)


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return create_tokens(user)


@router.post("/google", response_model=TokenResponse)
async def google_login(data: GoogleLogin, db: Session = Depends(get_db)):
    try:
        user = await authenticate_google(db, data.token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    return create_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: TokenRefresh, db: Session = Depends(get_db)):
    tokens = refresh_access_token(db, data.refresh_token)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    return tokens


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user_unverified)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.name is not None:
        current_user.name = data.name
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/logout")
async def logout(request: Request, current_user: User = Depends(get_current_user_unverified)):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token:
        r = get_redis()
        if r:
            r.setex(f"blacklist:{token}", 3600, "1")
    return {"message": "Logged out successfully"}


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------
@router.post("/send-verification")
def send_verification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_unverified),
):
    """Send (or re-send) email verification link. Rate-limited to 1 per 60s."""
    if current_user.email_verified:
        return {"message": "Email já verificado"}

    # Rate limit: 60 seconds between sends
    if current_user.email_verification_sent_at:
        elapsed = (datetime.now(timezone.utc) - current_user.email_verification_sent_at).total_seconds()
        if elapsed < 60:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Aguarde {int(60 - elapsed)} segundos para reenviar.",
            )

    token = str(_uuid.uuid4())
    current_user.email_verification_token = token
    current_user.email_verification_sent_at = datetime.now(timezone.utc)
    db.add(current_user)
    db.commit()

    verification_url = f"{settings.APP_URL}/verify-email?token={token}"
    send_verification_email(current_user.email, current_user.name, verification_url)
    return {"message": "Email de verificação enviado"}


@router.get("/verify-email")
def verify_email(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Verify email via token link (no auth required — user clicks from email)."""
    user = db.query(User).filter(User.email_verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido ou já utilizado")

    # Check expiry: 24 hours
    if user.email_verification_sent_at:
        elapsed = (datetime.now(timezone.utc) - user.email_verification_sent_at).total_seconds()
        if elapsed > 86400:
            raise HTTPException(status_code=400, detail="Token expirado. Solicite um novo email de verificação.")

    user.email_verified = True
    user.email_verification_token = None
    db.add(user)
    db.commit()

    base_url = settings.APP_URL.rstrip("/")
    return RedirectResponse(url=f"{base_url}/verify-email?verified=true")


# ---------------------------------------------------------------------------
# Helpers for secure OAuth redirects
# ---------------------------------------------------------------------------
def _safe_redirect_error(base_url: str, error_msg: str) -> RedirectResponse:
    """Build a safe redirect with URL-encoded, truncated error message."""
    safe_msg = quote(str(error_msg)[:150], safe="")
    return RedirectResponse(url=f"{base_url}/login?error={safe_msg}")


def _redis_get_str(r, key: str) -> str | None:
    """Get a Redis key and ensure it's returned as str (handles bytes)."""
    val = r.get(key)
    if val is None:
        return None
    return val.decode() if isinstance(val, bytes) else val


def _store_oauth_tokens(tokens: dict, provider: str, pipeline_started: bool) -> str:
    """Store JWT tokens in Redis under a one-time code (120s TTL).
    Returns the one-time code for the redirect URL."""
    r = get_redis()
    if not r:
        raise ValueError("Redis unavailable for token storage")
    code = secrets.token_urlsafe(48)
    import json
    payload = json.dumps({
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "provider": provider,
        "pipeline_started": pipeline_started,
    })
    r.setex(f"oauth_login_code:{code}", 120, payload)
    return code


class ExchangeCodeRequest(BaseModel):
    code: str


@router.post("/exchange-code")
def exchange_oauth_code(data: ExchangeCodeRequest):
    """Exchange a one-time OAuth login code for JWT tokens.
    The code was stored in Redis during the OAuth callback."""
    r = get_redis()
    if not r:
        raise HTTPException(status_code=503, detail="Redis unavailable")

    import json
    raw = _redis_get_str(r, f"oauth_login_code:{data.code}")
    if not raw:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    r.delete(f"oauth_login_code:{data.code}")

    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid code payload")

    return {
        "access_token": payload["access_token"],
        "refresh_token": payload["refresh_token"],
        "provider": payload.get("provider"),
        "pipeline_started": payload.get("pipeline_started", False),
    }


# ---------------------------------------------------------------------------
# Instagram OAuth Login (no auth required — this IS the login)
# ---------------------------------------------------------------------------
@router.get("/instagram/auth-url")
def instagram_auth_url():
    """Generate Instagram OAuth URL for social login."""
    from app.services.instagram_service import generate_auth_url

    r = get_redis()
    if not r:
        raise HTTPException(status_code=503, detail="Redis unavailable")

    state = secrets.token_urlsafe(32)
    r.setex(f"oauth_state:{state}", 600, "instagram")

    auth_url = generate_auth_url(state=state, redirect_uri=settings.INSTAGRAM_REDIRECT_URI)
    return {"auth_url": auth_url}


@router.get("/instagram/callback")
async def instagram_login_callback(
    code: str = Query(None),
    state: str = Query(""),
    error: str = Query(None),
    error_description: str = Query(None),
    db: Session = Depends(get_db),
):
    """Instagram OAuth callback for social login — stores tokens via one-time code and redirects."""
    base_url = settings.APP_URL.rstrip("/")

    if error:
        logger.error("Instagram OAuth login error: %s - %s", error, error_description)
        return _safe_redirect_error(base_url, error_description or error)

    if not code:
        return _safe_redirect_error(base_url, "missing_code")

    # Validate CSRF state (must be non-empty)
    if not state or not state.strip():
        return _safe_redirect_error(base_url, "missing_state")

    r = get_redis()
    if not r:
        return _safe_redirect_error(base_url, "server_error")

    stored = _redis_get_str(r, f"oauth_state:{state}")
    if not stored or stored != "instagram":
        logger.error("Instagram OAuth login: invalid state %s", state)
        return _safe_redirect_error(base_url, "invalid_state")
    r.delete(f"oauth_state:{state}")

    try:
        from app.services.instagram_service import (
            _exchange_code_for_short_token,
            _exchange_for_long_lived_token,
            _fetch_user_profile,
        )
        from app.services.oauth_service import find_or_create_user_from_social

        # Exchange code -> short token -> long-lived token
        short_token = await _exchange_code_for_short_token(code, redirect_uri=settings.INSTAGRAM_REDIRECT_URI)
        long_lived_data = await _exchange_for_long_lived_token(short_token)
        long_lived_token = long_lived_data["access_token"]
        expires_in = long_lived_data.get("expires_in", 5184000)

        # Fetch profile
        profile = await _fetch_user_profile(long_lived_token)
        platform_user_id = str(profile["id"])
        username = profile.get("username", "")

        profile_data = {
            "username": username,
            "display_name": profile.get("name", username),
            "profile_image_url": profile.get("profile_picture_url"),
            "profile_url": f"https://www.instagram.com/{username}/",
            "followers_count": profile.get("followers_count", 0),
        }

        token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        user, connection = find_or_create_user_from_social(
            db=db,
            platform="instagram",
            platform_user_id=platform_user_id,
            profile_data=profile_data,
            access_token=long_lived_token,
            token_expires_at=token_expires_at,
            scopes=settings.INSTAGRAM_SCOPES.split(","),
            raw_profile=profile,
        )

        tokens = create_tokens(user)

        # Auto-trigger data ingestion pipeline in background
        pipeline_started = False
        try:
            from app.tasks.pipeline_tasks import task_full_pipeline
            task_full_pipeline.delay(str(connection.id), str(user.id), max_posts=50, max_comments_per_post=100)
            pipeline_started = True
            logger.info("Auto-triggered pipeline for Instagram login user %s, connection %s", user.id, connection.id)
        except Exception as exc:
            logger.error("Failed to trigger pipeline after Instagram login: %s", exc)

        # Store tokens in Redis via one-time code (never in URL)
        login_code = _store_oauth_tokens(tokens, "instagram", pipeline_started)
        return RedirectResponse(url=f"{base_url}/login?oauth_code={login_code}")

    except ValueError as e:
        logger.error("Instagram OAuth login failed: %s", e)
        return _safe_redirect_error(base_url, str(e))


# ---------------------------------------------------------------------------
# TikTok OAuth Login (no auth required)
# ---------------------------------------------------------------------------
@router.get("/tiktok/auth-url")
def tiktok_auth_url():
    """Generate TikTok OAuth URL for social login."""
    from app.services.tiktok_service import generate_auth_url

    r = get_redis()
    if not r:
        raise HTTPException(status_code=503, detail="Redis unavailable")

    state = secrets.token_urlsafe(32)
    auth_url, code_verifier = generate_auth_url(state=state)

    # Store state + code_verifier in Redis with 10min TTL
    r.setex(f"oauth_state:{state}", 600, f"tiktok:{code_verifier}")

    return {"auth_url": auth_url}


@router.get("/tiktok/callback")
async def tiktok_login_callback(
    code: str = Query(None),
    state: str = Query(""),
    error: str = Query(None),
    error_description: str = Query(None),
    db: Session = Depends(get_db),
):
    """TikTok OAuth callback for social login — stores tokens via one-time code and redirects."""
    base_url = settings.APP_URL.rstrip("/")

    if error:
        logger.error("TikTok OAuth login error: %s - %s", error, error_description)
        return _safe_redirect_error(base_url, error_description or error)

    if not code:
        return _safe_redirect_error(base_url, "missing_code")

    # Validate CSRF state (must be non-empty)
    if not state or not state.strip():
        return _safe_redirect_error(base_url, "missing_state")

    r = get_redis()
    if not r:
        return _safe_redirect_error(base_url, "server_error")

    stored = _redis_get_str(r, f"oauth_state:{state}")
    if not stored or not stored.startswith("tiktok:"):
        logger.error("TikTok OAuth login: invalid state %s", state)
        return _safe_redirect_error(base_url, "invalid_state")
    r.delete(f"oauth_state:{state}")

    code_verifier = stored.split(":", 1)[1]

    try:
        from app.services.tiktok_service import exchange_code_for_tokens, fetch_user_profile
        from app.services.oauth_service import find_or_create_user_from_social

        # Exchange code for tokens
        token_data = await exchange_code_for_tokens(code, code_verifier)
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 86400)

        # Fetch profile
        profile = await fetch_user_profile(access_token)
        open_id = token_data.get("open_id") or profile.get("open_id", "")

        if not open_id:
            raise ValueError("TikTok did not return a valid open_id")

        username = profile.get("username", "")

        profile_data = {
            "username": username or f"tiktok_{open_id[:8]}",
            "display_name": profile.get("display_name", username),
            "profile_image_url": profile.get("avatar_url"),
            "profile_url": f"https://www.tiktok.com/@{username}" if username else None,
            "followers_count": profile.get("follower_count", 0),
        }

        token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        user, connection = find_or_create_user_from_social(
            db=db,
            platform="tiktok",
            platform_user_id=open_id,
            profile_data=profile_data,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at,
            scopes=token_data.get("scope", "").split(",") if token_data.get("scope") else ["user.info.basic"],
            raw_profile=profile,
        )

        tokens = create_tokens(user)

        # Auto-trigger data ingestion pipeline in background
        pipeline_started = False
        try:
            from app.tasks.pipeline_tasks import task_full_pipeline
            task_full_pipeline.delay(str(connection.id), str(user.id), max_posts=50, max_comments_per_post=100)
            pipeline_started = True
            logger.info("Auto-triggered pipeline for TikTok login user %s, connection %s", user.id, connection.id)
        except Exception as exc:
            logger.error("Failed to trigger pipeline after TikTok login: %s", exc)

        # Store tokens in Redis via one-time code (never in URL)
        login_code = _store_oauth_tokens(tokens, "tiktok", pipeline_started)
        return RedirectResponse(url=f"{base_url}/login?oauth_code={login_code}")

    except ValueError as e:
        logger.error("TikTok OAuth login failed: %s", e)
        return _safe_redirect_error(base_url, str(e))
