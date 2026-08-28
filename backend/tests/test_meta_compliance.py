"""Callbacks de compliance da Meta (deauthorize + data deletion)."""

import base64
import hashlib
import hmac
import json
import uuid

from app.core.config import settings
from app.models.social_connection import SocialConnection
from app.models.user import User


def _make_signed_request(payload: dict) -> str:
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    sig = hmac.new(
        settings.INSTAGRAM_APP_SECRET.encode(), payload_b64.encode(), hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{sig_b64}.{payload_b64}"


def _social_only_user_with_ig(db, ig_user_id="17840000001"):
    user = User(
        id=uuid.uuid4(),
        email=f"ig_{ig_user_id}@social.sentimenta.internal",
        password_hash=None,
        email_verified=True,
    )
    db.add(user)
    db.flush()
    conn = SocialConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        platform="instagram",
        platform_user_id=ig_user_id,
        username="tester_ig",
        status="active",
    )
    db.add(conn)
    db.commit()
    return user, conn


def test_data_deletion_requires_valid_signature(client):
    res = client.post("/api/v1/meta/data-deletion", data={"signed_request": "abc.def"})
    assert res.status_code == 400


def test_deauthorize_revokes_connection(client, db):
    user, conn = _social_only_user_with_ig(db, "17840000002")
    sr = _make_signed_request({"user_id": "17840000002", "algorithm": "HMAC-SHA256"})

    res = client.post("/api/v1/meta/deauthorize", data={"signed_request": sr})
    assert res.status_code == 200
    db.expire_all()
    db.refresh(conn)
    assert conn.status == "revoked"
    assert conn.auto_sync is False


def test_data_deletion_removes_social_only_account(client, db):
    user, conn = _social_only_user_with_ig(db, "17840000003")
    user_id = user.id
    sr = _make_signed_request({"user_id": "17840000003", "algorithm": "HMAC-SHA256"})

    res = client.post("/api/v1/meta/data-deletion", data={"signed_request": sr})
    assert res.status_code == 200
    body = res.json()
    assert body["confirmation_code"]
    assert "exclusao-de-dados" in body["url"]

    db.expire_all()
    assert db.get(User, user_id) is None
    assert (
        db.query(SocialConnection).filter(SocialConnection.platform_user_id == "17840000003").first()
        is None
    )


def test_data_deletion_unknown_user_still_returns_code(client):
    sr = _make_signed_request({"user_id": "999999999", "algorithm": "HMAC-SHA256"})
    res = client.post("/api/v1/meta/data-deletion", data={"signed_request": sr})
    assert res.status_code == 200
    assert res.json()["confirmation_code"]


def test_deletion_status_endpoint(client):
    res = client.get("/api/v1/meta/deletion-status/algumcodigo")
    assert res.status_code == 200
    assert res.json()["status"] == "completed"
