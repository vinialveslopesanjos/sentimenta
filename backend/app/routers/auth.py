import logging
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.cache import get_redis
from app.core.config import settings
from app.core.deps import get_current_user, get_current_user_unverified
from app.core.security import hash_action_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    GoogleLogin,
    LogoutRequest,
    ResetPasswordRequest,
    TokenRefresh,
    TokenResponse,
    UserLogin,
    UserRegister,
    OnboardingRequest,
    UserResponse,
    UserUpdate,
)
from app.services.auth_service import (
    authenticate_google,
    authenticate_user,
    change_password,
    create_tokens,
    mark_terms_accepted,
    refresh_access_token,
    register_user,
    revoke_all_tokens,
)
from app.services.email_service import send_password_reset_email, send_verification_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_COOKIE = "sentimenta_access_token"
REFRESH_COOKIE = "sentimenta_refresh_token"
SESSION_MARKER_COOKIE = "sentimenta_session"


def _cookie_domain() -> str | None:
    return settings.SESSION_COOKIE_DOMAIN or None


def _set_auth_cookies(response: Response, tokens: dict) -> None:
    common = {
        "secure": settings.SESSION_COOKIE_SECURE,
        "samesite": settings.SESSION_COOKIE_SAMESITE,
        "domain": _cookie_domain(),
        "path": "/",
    }
    response.set_cookie(
        ACCESS_COOKIE,
        tokens["access_token"],
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        tokens["refresh_token"],
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        httponly=True,
        **common,
    )
    response.set_cookie(
        SESSION_MARKER_COOKIE,
        "1",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        httponly=False,
        **common,
    )


def _clear_auth_cookies(response: Response) -> None:
    for cookie_name in (ACCESS_COOKIE, REFRESH_COOKIE, SESSION_MARKER_COOKIE):
        response.delete_cookie(
            cookie_name,
            domain=_cookie_domain(),
            path="/",
            secure=settings.SESSION_COOKIE_SECURE,
            samesite=settings.SESSION_COOKIE_SAMESITE,
        )


def _find_user_by_action_token(db: Session, column_name: str, token: str) -> User | None:
    column = getattr(User, column_name)
    token_hash = hash_action_token(token)
    user = db.query(User).filter(column == token_hash).first()
    if user:
        return user
    return db.query(User).filter(column == token).first()


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    data: UserRegister,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    from app.middleware.rate_limiter import rate_limiter
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"register:{client_ip}", max_requests=5, window_seconds=3600)

    try:
        user = register_user(db, data.email, data.password, data.name)
        mark_terms_accepted(
            user,
            accepted_ip=request.client.host if request.client else None,
            version=settings.TERMS_VERSION,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    # Generate verification token and send email
    try:
        token = secrets.token_urlsafe(32)
        user.email_verification_token = hash_action_token(token)
        user.email_verification_sent_at = datetime.now(timezone.utc)
        db.add(user)
        db.commit()

        verification_url = f"{settings.APP_URL}/verify-email?token={token}"
        send_verification_email(user.email, user.name, verification_url)
    except Exception as exc:
        logger.error("Failed to send verification email on register: %s", exc)

    from app.core.analytics import capture, identify
    identify(str(user.id), {"email": user.email, "name": user.name, "plan": user.plan})
    capture(str(user.id), "user_signup", {"plan": user.plan})

    tokens = create_tokens(user)
    _set_auth_cookies(response, tokens)
    return tokens


@router.post("/login", response_model=TokenResponse)
def login(
    data: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    from app.middleware.rate_limiter import rate_limiter
    client_ip = request.client.host if request.client else "unknown"
    qa_fixture_sweep = settings.QA_LOCAL_MODE and settings.READ_ONLY_MODE and settings.DEBUG
    rate_limiter.check(
        f"login:{client_ip}",
        # The isolated, localhost-only, read-only QA sweep signs in with many
        # deterministic accounts in one minute. Production keeps the strict
        # five-attempt ceiling.
        max_requests=100 if qa_fixture_sweep else 5,
        window_seconds=60,
    )

    user = authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox.",
        )

    from app.core.analytics import capture, identify
    identify(str(user.id), {"email": user.email, "name": user.name, "plan": user.plan})
    capture(str(user.id), "user_login")

    tokens = create_tokens(user)
    _set_auth_cookies(response, tokens)
    return tokens


@router.post("/google", response_model=TokenResponse)
async def google_login(data: GoogleLogin, response: Response, db: Session = Depends(get_db)):
    try:
        user = await authenticate_google(db, data.token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    tokens = create_tokens(user)
    _set_auth_cookies(response, tokens)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    data: TokenRefresh,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    refresh_token = data.refresh_token or request.cookies.get(REFRESH_COOKIE)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    tokens = refresh_access_token(db, refresh_token)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    _set_auth_cookies(response, tokens)
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


@router.post("/onboarding", response_model=UserResponse)
def save_onboarding(
    data: OnboardingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.onboarding_data = {
        "profile_type": data.profile_type,
        "main_goal": data.main_goal,
        "description": data.description,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }

    # Set persona on all user's connections for LLM analysis context
    from app.models.social_connection import SocialConnection
    connections = db.query(SocialConnection).filter(
        SocialConnection.user_id == current_user.id
    ).all()
    for conn in connections:
        conn.persona = data.description

    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    data: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_unverified),
):
    """Delete user account and all associated data (LGPD compliance)."""
    if current_user.password_hash:
        from app.core.security import verify_password

        if not data.password or not verify_password(data.password, current_user.password_hash):
            raise HTTPException(status_code=401, detail="Senha atual incorreta")

    if current_user.stripe_subscription_id:
        try:
            from app.services.stripe_service import cancel_subscription

            cancel_subscription(current_user.stripe_subscription_id)
        except Exception as exc:
            logger.warning("Failed to cancel Stripe subscription for user %s: %s", current_user.id, exc)

    # The User model has cascade="all, delete-orphan" on:
    #   - connections (SocialConnection) -> which cascades to posts, comments
    #   - pipeline_runs (PipelineRun)
    # Credit and usage tables are not ORM children of User, so clear them
    # explicitly before deleting the user to keep LGPD deletion reliable.
    from app.models.credits import CreditBalance, CreditTransaction
    from app.models.demographics import UsageLog

    db.query(CreditTransaction).filter(CreditTransaction.user_id == current_user.id).delete(
        synchronize_session=False
    )
    db.query(CreditBalance).filter(CreditBalance.user_id == current_user.id).delete(
        synchronize_session=False
    )
    db.query(UsageLog).filter(UsageLog.user_id == current_user.id).delete(
        synchronize_session=False
    )

    logger.info("Deleting account for user %s (%s)", current_user.id, current_user.email)
    db.delete(current_user)
    db.commit()
    return None


@router.post("/logout")
async def logout(
    payload: LogoutRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_unverified),
):
    token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.cookies.get(ACCESS_COOKIE, "")
    refresh_token = payload.refresh_token or request.cookies.get(REFRESH_COOKIE)
    r = get_redis()
    if r:
        if token:
            r.setex(f"blacklist:{token}", 3600, "1")
        if refresh_token:
            r.setex(
                f"blacklist:{refresh_token}",
                settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
                "1",
            )
    revoke_all_tokens(db, current_user)
    _clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.post("/change-password", response_model=TokenResponse)
def change_password_endpoint(
    data: ChangePasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_unverified),
):
    try:
        updated_user = change_password(db, current_user, data.current_password, data.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    tokens = create_tokens(updated_user)
    _set_auth_cookies(response, tokens)
    return tokens


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------
@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Request password reset email. Always returns 200 to not reveal if email exists."""
    from app.middleware.rate_limiter import rate_limiter
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"forgot_password:{client_ip}", max_requests=3, window_seconds=3600)

    user = db.query(User).filter(User.email == data.email).first()
    if user and user.password_hash:
        token = secrets.token_urlsafe(32)
        user.password_reset_token = hash_action_token(token)
        user.password_reset_sent_at = datetime.now(timezone.utc)
        db.add(user)
        db.commit()

        reset_url = f"{settings.APP_URL}/reset-password?token={token}"
        try:
            send_password_reset_email(user.email, user.name, reset_url)
        except Exception as exc:
            logger.error("Failed to send password reset email: %s", exc)

    return {"message": "Se o email existir, enviaremos um link de redefinicao."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using token from email."""
    user = _find_user_by_action_token(db, "password_reset_token", data.token)
    if not user:
        raise HTTPException(status_code=400, detail="Token invalido ou ja utilizado")

    if user.password_reset_sent_at:
        elapsed = (datetime.now(timezone.utc) - _as_utc(user.password_reset_sent_at)).total_seconds()
        if elapsed > 3600:  # 1 hour
            raise HTTPException(status_code=400, detail="Token expirado. Solicite um novo link.")

    from app.core.security import hash_password
    user.password_hash = hash_password(data.new_password)
    user.password_reset_token = None
    user.password_reset_sent_at = None
    user.token_version += 1  # Revoke all existing sessions
    db.add(user)
    db.commit()

    return {"message": "Senha redefinida com sucesso."}


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
        elapsed = (datetime.now(timezone.utc) - _as_utc(current_user.email_verification_sent_at)).total_seconds()
        if elapsed < 60:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Aguarde {int(60 - elapsed)} segundos para reenviar.",
            )

    token = secrets.token_urlsafe(32)
    current_user.email_verification_token = hash_action_token(token)
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
    user = _find_user_by_action_token(db, "email_verification_token", token)
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido ou já utilizado")

    # Check expiry: 24 hours
    if user.email_verification_sent_at:
        elapsed = (datetime.now(timezone.utc) - _as_utc(user.email_verification_sent_at)).total_seconds()
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
def exchange_oauth_code(data: ExchangeCodeRequest, response: Response):
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

    tokens = {
        "access_token": payload["access_token"],
        "refresh_token": payload["refresh_token"],
        "token_type": "bearer",
    }
    _set_auth_cookies(response, tokens)
    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": tokens["token_type"],
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
