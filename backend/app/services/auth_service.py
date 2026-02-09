import uuid

import httpx
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User


GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def register_user(db: Session, email: str, password: str, name: str | None = None) -> User:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        name=name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def authenticate_google(db: Session, google_token: str) -> User:
    """Verify Google token and create/get user."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_token}"},
        )
        if response.status_code != 200:
            raise ValueError("Invalid Google token")
        userinfo = response.json()

    email = userinfo.get("email")
    if not email:
        raise ValueError("Google account has no email")

    # Check if user exists by google_id or email
    google_id = userinfo.get("sub")
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
        db.commit()
        db.refresh(user)
    else:
        # Create new user
        user = User(
            email=email,
            google_id=google_id,
            name=userinfo.get("name"),
            avatar_url=userinfo.get("picture"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user


def create_tokens(user: User) -> dict:
    data = {"sub": str(user.id)}
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

    return create_tokens(user)
