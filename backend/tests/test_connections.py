"""Tests for connections endpoints."""


def test_list_connections_empty(client, auth_headers):
    res = client.get("/api/v1/connections/", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_list_connections_with_data(client, auth_headers, test_connection):
    res = client.get("/api/v1/connections/", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["platform"] == "youtube"
    assert data[0]["username"] == "@TestChannel"


def test_get_connection(client, auth_headers, test_connection):
    res = client.get(
        f"/api/v1/connections/{test_connection.id}", headers=auth_headers
    )
    assert res.status_code == 200
    assert res.json()["username"] == "@TestChannel"


def test_get_connection_not_found(client, auth_headers):
    res = client.get(
        "/api/v1/connections/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert res.status_code == 404


def test_delete_connection(client, auth_headers, test_connection):
    res = client.delete(
        f"/api/v1/connections/{test_connection.id}", headers=auth_headers
    )
    assert res.status_code == 204

    # Verify it's gone
    res = client.get("/api/v1/connections/", headers=auth_headers)
    assert len(res.json()) == 0


def test_connections_require_auth(client):
    res = client.get("/api/v1/connections/")
    assert res.status_code == 401


def test_instagram_auth_url(client, auth_headers):
    res = client.get("/api/v1/connections/instagram/auth-url", headers=auth_headers)
    # Should return 200 even with empty INSTAGRAM_APP_ID (generates URL with empty params)
    assert res.status_code == 200
    data = res.json()
    assert "auth_url" in data
    assert "instagram.com/oauth/authorize" in data["auth_url"]
