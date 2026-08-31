import asyncio
import uuid
from datetime import datetime, timezone

from google.auth import exceptions as google_auth_exceptions
from google.auth.transport import requests as google_auth_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    token_version_matches,
    verify_password,
)
from app.models.user import User


class GoogleSignInUnavailableError(RuntimeError):
    """Google sign-in cannot be completed because the verifier is unavailable."""


def _verify_google_id_token(google_token: str) -> dict:
    """Validate a Google Identity Services ID token for this web client."""
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleSignInUnavailableError("Google sign-in is not configured")

    try:
        return google_id_token.verify_oauth2_token(
            google_token,
            google_auth_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise ValueError("Invalid Google token") from exc
    except google_auth_exceptions.GoogleAuthError as exc:
        raise GoogleSignInUnavailableError(
            "Google sign-in is temporarily unavailable"
        ) from exc


def register_user(db: Session, email: str, password: str, name: str | None = None) -> User:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("Email already registered")

    ADMIN_EMAILS = {"cleoloopes@hotmail.com", "vinialveslopesanjos@gmail.com", "vinicius.anjos@mazylabs.com"}

    user = User(
        email=email,
        password_hash=hash_password(password),
        name=name,
        plan="admin" if email.lower() in ADMIN_EMAILS else "free",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def mark_terms_accepted(user: User, accepted_ip: str | None, version: str) -> None:
    user.terms_accepted_at = datetime.now(timezone.utc)
    user.terms_accepted_ip = accepted_ip
    user.terms_accepted_version = version


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def authenticate_google(db: Session, google_token: str) -> User:
    """Verify a Google ID token and create or retrieve its local user."""
    userinfo = await asyncio.to_thread(_verify_google_id_token, google_token)

    email = userinfo.get("email")
    if not isinstance(email, str) or not email.strip():
        raise ValueError("Google account has no email")
    if userinfo.get("email_verified") not in {True, "true", "True"}:
        raise ValueError("Google email is not verified")
    email = email.strip().lower()

    # Check if user exists by google_id or email
    google_id = userinfo.get("sub")
    if not isinstance(google_id, str) or not google_id.strip():
        raise ValueError("Invalid Google token")
    google_id = google_id.strip()
    user = db.query(User).filter(
        (User.google_id == google_id) | (User.email == email)
    ).first()

    if user:
        # Update google_id if not set
        if not user.google_id:
            user.google_id = google_id
        if not user.avatar_url and userinfo.get("picture"):
            user.avatar_url = userinfo["picture"]
        if not user.name and userinfo.get("name"):
            user.name = userinfo["name"]
        # Google-verified email — auto-verify
        if not user.email_verified:
            user.email_verified = True
        db.commit()
        db.refresh(user)
    else:
        # Create new user
        user = User(
            email=email,
            google_id=google_id,
            name=userinfo.get("name"),
            avatar_url=userinfo.get("picture"),
            email_verified=True,  # Google OAuth = email already verified
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user


def create_tokens(user: User) -> dict:
    data = {"sub": str(user.id), "token_version": user.token_version}
    return {
        "access_token": create_access_token(data),
        "refresh_token": create_refresh_token(data),
        "token_type": "bearer",
    }


def refresh_access_token(db: Session, refresh_token: str) -> dict | None:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return None

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        return None
    if not token_version_matches(payload, user.token_version):
        return None

    return create_tokens(user)


def revoke_all_tokens(db: Session, user: User) -> User:
    user.token_version += 1
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> User:
    if not user.password_hash:
        raise ValueError("Esta conta usa login social e nao tem senha local cadastrada")
    if not verify_password(current_password, user.password_hash):
        raise ValueError("Senha atual incorreta")
    user.password_hash = hash_password(new_password)
    user.token_version += 1
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
