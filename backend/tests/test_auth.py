"""Tests for authentication endpoints."""

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


def test_refresh_invalid_token(client):
    res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "bad-token"},
    )
    assert res.status_code == 401


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
