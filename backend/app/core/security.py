import base64
from datetime import datetime, timedelta, timezone

import bcrypt
from cryptography.fernet import Fernet
from jose import jwt, JWTError

from app.core.config import settings

# Token encryption (AES via Fernet)
_fernet = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.TOKEN_ENCRYPTION_KEY
        if not key:
            key = Fernet.generate_key().decode()
        else:
            # Ensure key is valid Fernet key (32 url-safe base64-encoded bytes)
            if len(key) != 44:
                key = base64.urlsafe_b64encode(key.ljust(32)[:32].encode()).decode()
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


# Password hashing (using bcrypt directly — passlib is incompatible with bcrypt>=5)
def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")[:72]  # bcrypt max 72 bytes
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# JWT tokens
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

    # Check if token has been blacklisted (logout)
    try:
        from app.core.cache import get_redis

        r = get_redis()
        if r and r.get(f"blacklist:{token}"):
            return None
    except Exception:
        pass

    return payload


# Social token encryption (AES-256 via Fernet)
def encrypt_token(token: str) -> str:
    return _get_fernet().encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    return _get_fernet().decrypt(encrypted_token.encode()).decode()
