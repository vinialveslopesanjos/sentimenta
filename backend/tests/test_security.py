"""Tests for security utilities (JWT, passwords, encryption)."""

import os
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite://")

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    encrypt_token,
    decrypt_token,
)


def test_password_hash_and_verify():
    password = "my-secure-password"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)


def test_password_verify_wrong():
    hashed = hash_password("correct")
    assert not verify_password("wrong", hashed)


def test_access_token_create_and_decode():
    data = {"sub": "user-123"}
    token = create_access_token(data)
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"


def test_refresh_token_create_and_decode():
    data = {"sub": "user-456"}
    token = create_refresh_token(data)
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-456"
    assert payload["type"] == "refresh"


def test_decode_invalid_token():
    result = decode_token("not-a-valid-token")
    assert result is None


def test_encrypt_decrypt_token():
    original = "ig_access_token_abc123_very_long_token"
    encrypted = encrypt_token(original)
    assert encrypted != original
    decrypted = decrypt_token(encrypted)
    assert decrypted == original


def test_encrypt_produces_different_outputs():
    """Fernet encryption should produce different ciphertexts for same input."""
    token = "same_token"
    enc1 = encrypt_token(token)
    enc2 = encrypt_token(token)
    # Fernet includes a timestamp, so encryptions differ
    assert enc1 != enc2
    # Both decrypt to the same value
    assert decrypt_token(enc1) == token
    assert decrypt_token(enc2) == token
