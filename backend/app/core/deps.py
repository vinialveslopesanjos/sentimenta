import uuid

from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.core.security import token_version_matches
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user_unverified(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate user by JWT but do NOT check email_verified.
    Use this for endpoints that must work before email verification
    (e.g. /auth/me, /auth/send-verification, /auth/logout).
    """
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not token_version_matches(payload, user.token_version):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_user(
    user: User = Depends(get_current_user_unverified),
) -> User:
    """Authenticate user AND require email_verified=True.
    Returns 403 with a specific detail code when email is not verified,
    so the frontend can redirect to the verification page.
    """
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="email_not_verified",
        )
    return user


async def get_current_user_token_or_query(
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)),
    query_token: str | None = Query(None, alias="token"),
    db: Session = Depends(get_db),
) -> User:
    """Gets the current user using either Auth header or query token (for SSE/WS)."""
    actual_token = token or query_token
    if not actual_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return get_current_user_unverified(actual_token, db)
