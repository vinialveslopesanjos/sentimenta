"""Tests for authentication endpoints."""

from urllib.parse import parse_qs, urlparse

from app.models.credits import CreditBalance, CreditTransaction
from app.models.demographics import UsageLog
from app.models.user import User
from tests.conftest import TestSessionLocal


def _verify_email(email: str):
    """Helper: mark a user's email as verified directly in DB."""
    db = TestSessionLocal()
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.email_verified = True
        db.commit()
    db.close()


def test_register_success(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "Secret123", "name": "New User", "accepted_terms": True},
    )
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert "sentimenta_access_token" in res.cookies
    assert "sentimenta_refresh_token" in res.cookies
    assert "sentimenta_session" in res.cookies


def test_register_duplicate_email(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "dup@example.com", "password": "Secret123", "accepted_terms": True},
    )
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "dup@example.com", "password": "Secret123", "accepted_terms": True},
    )
    assert res.status_code == 409


def test_login_success(client):
    # Register first
    client.post(
        "/api/v1/auth/register",
        json={"email": "login@example.com", "password": "MyPass123", "accepted_terms": True},
    )
    _verify_email("login@example.com")
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "MyPass123"},
    )
    assert res.status_code == 200
    assert "access_token" in res.json()
    assert "sentimenta_access_token" in res.cookies


def test_login_unverified_email(client):
    """Login should fail with 403 if email is not verified."""
    client.post(
        "/api/v1/auth/register",
        json={"email": "unverified@example.com", "password": "MyPass123", "accepted_terms": True},
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "unverified@example.com", "password": "MyPass123"},
    )
    assert res.status_code == 403


def test_login_wrong_password(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "wrong@example.com", "password": "Correct123", "accepted_terms": True},
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "wrong@example.com", "password": "incorrect"},
    )
    assert res.status_code == 401


def test_login_nonexistent_user(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "pass"},
    )
    assert res.status_code == 401


def test_me_authenticated(client, auth_headers):
    res = client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"


def test_me_no_token(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_me_invalid_token(client):
    res = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer invalid-token"}
    )
    assert res.status_code == 401


def test_refresh_token(client):
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "refresh@example.com", "password": "Secret123", "accepted_terms": True},
    )
    refresh_token = reg.json()["refresh_token"]

    res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_refresh_accepts_httponly_cookie(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "cookie-refresh@example.com", "password": "Secret123", "accepted_terms": True},
    )

    res = client.post("/api/v1/auth/refresh", json={})

    assert res.status_code == 200
    assert "access_token" in res.json()
    assert "sentimenta_access_token" in res.cookies


def test_refresh_invalid_token(client):
    res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "bad-token"},
    )
    assert res.status_code == 401


def test_email_verification_token_is_hashed_and_still_usable(client, monkeypatch):
    captured = {}

    def fake_send_verification_email(email, name, verification_url):
        captured["url"] = verification_url
        return True

    monkeypatch.setattr("app.routers.auth.send_verification_email", fake_send_verification_email)

    res = client.post(
        "/api/v1/auth/register",
        json={"email": "verify-hash@example.com", "password": "Secret123", "accepted_terms": True},
    )

    assert res.status_code == 201
    token = parse_qs(urlparse(captured["url"]).query)["token"][0]

    db = TestSessionLocal()
    user = db.query(User).filter(User.email == "verify-hash@example.com").one()
    assert user.email_verification_token != token
    assert len(user.email_verification_token) == 64
    db.close()

    verify = client.get(f"/api/v1/auth/verify-email?token={token}", follow_redirects=False)
    assert verify.status_code in {302, 307}

    db = TestSessionLocal()
    user = db.query(User).filter(User.email == "verify-hash@example.com").one()
    assert user.email_verified is True
    assert user.email_verification_token is None
    db.close()


def test_password_reset_token_is_hashed_and_still_usable(client, monkeypatch):
    captured = {}

    def fake_send_password_reset_email(email, name, reset_url):
        captured["url"] = reset_url
        return True

    monkeypatch.setattr("app.routers.auth.send_password_reset_email", fake_send_password_reset_email)
    client.post(
        "/api/v1/auth/register",
        json={"email": "reset-hash@example.com", "password": "Secret123", "accepted_terms": True},
    )

    forgot = client.post("/api/v1/auth/forgot-password", json={"email": "reset-hash@example.com"})
    assert forgot.status_code == 200
    token = parse_qs(urlparse(captured["url"]).query)["token"][0]

    db = TestSessionLocal()
    user = db.query(User).filter(User.email == "reset-hash@example.com").one()
    assert user.password_reset_token != token
    assert len(user.password_reset_token) == 64
    db.close()

    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "NewSecret123"},
    )
    assert reset.status_code == 200

    db = TestSessionLocal()
    user = db.query(User).filter(User.email == "reset-hash@example.com").one()
    assert user.password_reset_token is None
    assert user.token_version == 1
    db.close()


def test_delete_account_clears_credit_and_usage_records(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "delete@example.com",
            "password": "Secret123",
            "accepted_terms": True,
        },
    )
    _verify_email("delete@example.com")
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "delete@example.com", "password": "Secret123"},
    )
    token = login.json()["access_token"]

    db = TestSessionLocal()
    user = db.query(User).filter(User.email == "delete@example.com").first()
    balance = CreditBalance(user_id=user.id, plan_credits=200, pack_credits=0)
    db.add(balance)
    db.flush()
    db.add(
        CreditTransaction(
            user_id=user.id,
            balance_id=balance.id,
            amount=-10,
            type="usage",
            balance_after=190,
            description="QA usage",
        )
    )
    db.add(
        UsageLog(
            user_id=user.id,
            platform="youtube",
            operation="ingest",
            comments_count=10,
            estimated_cost_usd=0.03,
        )
    )
    db.commit()
    db.close()

    res = client.request(
        "DELETE",
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"confirmation_text": "DELETAR", "password": "Secret123"},
    )
    assert res.status_code == 204

    db = TestSessionLocal()
    assert db.query(User).filter(User.email == "delete@example.com").count() == 0
    assert db.query(CreditBalance).count() == 0
    assert db.query(CreditTransaction).count() == 0
    assert db.query(UsageLog).count() == 0
    db.close()
