"""Tests for posts and dashboard endpoints."""


def test_list_posts_empty(client, auth_headers):
    res = client.get("/api/v1/posts", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_list_posts_with_data(client, auth_headers, test_post):
    res = client.get("/api/v1/posts", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["platform"] == "youtube"
    assert data[0]["platform_post_id"] == "test_video_123"


def test_post_detail(client, auth_headers, test_post, test_comments):
    res = client.get(f"/api/v1/posts/{test_post.id}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["post"]["platform_post_id"] == "test_video_123"
    assert len(data["comments"]) == 5
    assert data["summary"] is None  # No analysis yet


def test_post_detail_not_found(client, auth_headers):
    res = client.get(
        "/api/v1/posts/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert res.status_code == 404


def test_posts_require_auth(client):
    res = client.get("/api/v1/posts")
    assert res.status_code == 401


def test_thumbnail_proxy_applies_rate_limits(client, monkeypatch):
    calls = []

    def fake_check(key, max_requests, window_seconds):
        calls.append((key, max_requests, window_seconds))

    monkeypatch.setattr("app.middleware.rate_limiter.rate_limiter.check", fake_check)

    res = client.get("/api/v1/posts/thumbnail")

    assert res.status_code == 404
    assert calls[0][0].startswith("thumbnail:ip:")
    assert calls[0][1:] == (240, 300)
    assert calls[1][0].startswith("thumbnail:target:")
    assert calls[1][1:] == (600, 3600)


def test_dashboard_summary_empty(client, auth_headers):
    res = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_connections"] == 0
    assert data["total_posts"] == 0
    assert data["avg_score"] is None


def test_dashboard_summary_with_data(client, auth_headers, test_post, test_comments):
    res = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_connections"] == 1
    assert data["total_posts"] == 1
    assert data["total_comments"] == 5
    assert data["total_analyzed"] == 0  # None processed yet


def test_dashboard_require_auth(client):
    res = client.get("/api/v1/dashboard/summary")
    assert res.status_code == 401
