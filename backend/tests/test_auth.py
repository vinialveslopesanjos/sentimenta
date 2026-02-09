"""Tests for authentication endpoints."""


def test_register_success(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "secret123", "name": "New User"},
    )
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_register_duplicate_email(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "dup@example.com", "password": "secret123"},
    )
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "dup@example.com", "password": "secret123"},
    )
    assert res.status_code == 409


def test_login_success(client):
    # Register first
    client.post(
        "/api/v1/auth/register",
        json={"email": "login@example.com", "password": "mypass123"},
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "mypass123"},
    )
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_login_wrong_password(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "wrong@example.com", "password": "correct"},
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
        json={"email": "refresh@example.com", "password": "secret123"},
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
