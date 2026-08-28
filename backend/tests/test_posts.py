"""Tests for posts and dashboard endpoints."""

from datetime import datetime, timedelta, timezone
import uuid

from app.models.analysis import CommentAnalysis
from app.models.comment import Comment
from app.models.pipeline_run import PipelineRun
from app.models.post import Post
from app.models.social_connection import SocialConnection


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


def test_post_detail(client, auth_headers, db, test_post, test_comments):
    db.add(
        CommentAnalysis(
            comment_id=test_comments[0].id,
            model="test-model",
            prompt_version="test-v1",
            score_0_10=8.0,
            polarity=0.6,
            intensity=0.5,
            emotions=["alegria"],
            topics=["produto"],
            sarcasm=False,
            confidence=1.0,
        )
    )
    db.commit()

    res = client.get(f"/api/v1/posts/{test_post.id}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["post"]["platform_post_id"] == "test_video_123"
    assert data["post"]["connection_id"] == str(test_post.connection_id)
    assert len(data["comments"]) == 5
    assert data["analysis"][0]["emotions"] == ["alegria"]
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


def test_dashboard_trends_are_unique_sorted_and_explicitly_utc(
    client,
    auth_headers,
    db,
    test_post,
    test_connection,
):
    inputs = [
        ("week-3", datetime(2026, 8, 17, 10, tzinfo=timezone.utc), 8.0),
        ("week-1", datetime(2026, 8, 3, 10, tzinfo=timezone.utc), 4.0),
        ("week-2-b", datetime(2026, 8, 12, 10, tzinfo=timezone.utc), 7.0),
        ("week-2-a", datetime(2026, 8, 10, 10, tzinfo=timezone.utc), 5.0),
    ]
    for external_id, published_at, score in inputs:
        comment = Comment(
            id=uuid.uuid4(),
            post_id=test_post.id,
            connection_id=test_connection.id,
            platform="youtube",
            platform_comment_id=external_id,
            text_original=external_id,
            text_clean=external_id,
            text_hash=external_id,
            published_at=published_at,
            status="processed",
        )
        db.add(comment)
        db.flush()
        db.add(
            CommentAnalysis(
                comment_id=comment.id,
                model="test-model",
                prompt_version="test-v1",
                score_0_10=score,
                confidence=1.0,
            )
        )
    db.commit()

    url = (
        f"/api/v1/dashboard/trends?connection_id={test_connection.id}"
        "&granularity=week&days=0"
    )
    first = client.get(url, headers=auth_headers)
    second = client.get(url, headers=auth_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["timezone"] == "UTC"
    points = first.json()["data_points"]
    assert [point["period"] for point in points] == [
        "2026-08-03",
        "2026-08-10",
        "2026-08-17",
    ]
    assert len({point["period"] for point in points}) == len(points)
    assert points[1]["avg_score"] == 6.0


def test_dashboard_trends_does_not_replace_an_empty_window_with_old_data(
    client,
    auth_headers,
    db,
    test_post,
    test_connection,
):
    comment = Comment(
        id=uuid.uuid4(),
        post_id=test_post.id,
        connection_id=test_connection.id,
        platform="youtube",
        platform_comment_id="old-comment",
        text_original="old-comment",
        text_clean="old-comment",
        text_hash="old-comment",
        published_at=datetime(2020, 1, 1, 10, tzinfo=timezone.utc),
        status="processed",
    )
    db.add(comment)
    db.commit()

    response = client.get(
        f"/api/v1/dashboard/trends?connection_id={test_connection.id}"
        "&granularity=week&days=30",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        "data_points": [],
        "granularity": "week",
        "timezone": "UTC",
    }


def test_compare_connections_exposes_identity_freshness_and_score_denominators(
    client,
    auth_headers,
    db,
    test_user,
    test_connection,
    test_post,
):
    user, _ = test_user
    now = datetime.now(timezone.utc)
    test_connection.username = "same-handle"
    second_connection = SocialConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        platform="instagram",
        username="same-handle",
        display_name="Same handle on Instagram",
        status="active",
        auto_sync=True,
    )
    second_post = Post(
        id=uuid.uuid4(),
        connection_id=second_connection.id,
        platform="instagram",
        platform_post_id="same-handle-instagram-post",
        post_type="image",
        published_at=now - timedelta(days=2),
    )
    db.add_all([second_connection, second_post])
    db.flush()

    def add_comment(post, connection, external_id, score):
        comment = Comment(
            id=uuid.uuid4(),
            post_id=post.id,
            connection_id=connection.id,
            platform=connection.platform,
            platform_comment_id=external_id,
            text_original=external_id,
            text_clean=external_id,
            text_hash=external_id,
            published_at=now - timedelta(days=1),
            status="processed",
        )
        db.add(comment)
        db.flush()
        if score is not None:
            db.add(
                CommentAnalysis(
                    comment_id=comment.id,
                    model="test-model",
                    prompt_version="test-v1",
                    score_0_10=score,
                    emotions=["alegria"],
                    confidence=1.0,
                )
            )

    add_comment(test_post, test_connection, "youtube-valid", 8.0)
    add_comment(test_post, test_connection, "youtube-without-valid-score", None)
    add_comment(second_post, second_connection, "instagram-valid", 6.0)

    db.add_all([
        PipelineRun(
            user_id=user.id,
            connection_id=test_connection.id,
            run_type="daily_sync",
            status="completed",
            comments_fetched=2,
            comments_analyzed=1,
            started_at=now - timedelta(hours=3),
            ended_at=now - timedelta(hours=2),
        ),
        PipelineRun(
            user_id=user.id,
            connection_id=second_connection.id,
            run_type="daily_sync",
            status="completed",
            comments_fetched=1,
            comments_analyzed=1,
            started_at=now - timedelta(hours=241),
            ended_at=now - timedelta(hours=240),
        ),
    ])
    db.commit()

    response = client.get(
        "/api/v1/dashboard/compare-connections"
        f"?connection_ids={test_connection.id},{second_connection.id}&days=3650",
        headers=auth_headers,
    )

    assert response.status_code == 200
    series = response.json()["connections"]
    assert [(item["platform"], item["username"]) for item in series] == [
        ("youtube", "same-handle"),
        ("instagram", "same-handle"),
    ]
    assert (series[0]["saved_count"], series[0]["valid_count"]) == (2, 1)
    assert (series[1]["saved_count"], series[1]["valid_count"]) == (1, 1)
    assert series[0]["total_comments"] == series[0]["saved_count"]
    assert series[0]["total_analyzed"] == series[0]["valid_count"]
    assert series[0]["observed_period_start"] is not None
    assert series[0]["observed_period_end"] is not None
    assert series[0]["health"]["state"] == "healthy"
    assert series[0]["health"]["last_success_at"] is not None
    assert series[1]["health"]["state"] == "stale"
    assert series[1]["health"]["last_success_at"] is not None
    assert series[0]["emotions_distribution"] == {"alegria": 1}
