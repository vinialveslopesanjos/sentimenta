"""Tests for connections endpoints."""

import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

from app.models.credits import CreditBalance
from app.models.pipeline_run import PipelineRun
from app.models.post import Post
from app.models.social_connection import SocialConnection


def test_list_connections_empty(client, auth_headers):
    res = client.get("/api/v1/connections", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_list_connections_with_data(client, auth_headers, test_connection):
    res = client.get("/api/v1/connections", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["platform"] == "youtube"
    assert data[0]["username"] == "@TestChannel"
    assert data[0]["health"]["state"] == "never_synced"
    assert data[0]["health"]["sync_frequency"] == "weekly"
    assert data[0]["health"]["next_scheduled_at"] is not None


def test_get_connection(client, auth_headers, test_connection):
    res = client.get(
        f"/api/v1/connections/{test_connection.id}", headers=auth_headers
    )
    assert res.status_code == 200
    assert res.json()["username"] == "@TestChannel"
    assert res.json()["health"]["state"] == "never_synced"


def test_list_connections_exposes_five_canonical_health_states(
    client,
    auth_headers,
    db,
    test_user,
):
    user, _ = test_user
    user.plan = "pro"
    now = datetime.now(timezone.utc)

    def add_connection(username: str, *, last_sync_at=None) -> SocialConnection:
        connection = SocialConnection(
            id=uuid.uuid4(),
            user_id=user.id,
            platform="youtube",
            username=username,
            display_name=username,
            status="active",
            auto_sync=True,
            last_sync_at=last_sync_at,
            connected_at=now,
        )
        db.add(connection)
        db.flush()
        return connection

    def add_run(
        connection: SocialConnection,
        *,
        status: str,
        age_hours: int,
        comments_fetched: int = 10,
        comments_analyzed: int = 10,
    ) -> None:
        db.add(
            PipelineRun(
                user_id=user.id,
                connection_id=connection.id,
                run_type="daily_sync",
                status=status,
                comments_fetched=comments_fetched,
                comments_analyzed=comments_analyzed,
                started_at=now - timedelta(hours=age_hours, minutes=10),
                ended_at=now - timedelta(hours=age_hours),
            )
        )

    healthy = add_connection("@healthy", last_sync_at=now - timedelta(hours=2))
    add_run(healthy, status="completed", age_hours=2)

    degraded = add_connection("@degraded", last_sync_at=now - timedelta(hours=3))
    add_run(degraded, status="completed", age_hours=3)
    add_run(degraded, status="failed", age_hours=1)

    stale = add_connection("@stale", last_sync_at=now - timedelta(hours=40))
    add_run(stale, status="completed", age_hours=40)

    failed = add_connection("@failed")
    add_run(failed, status="failed", age_hours=1)

    add_connection("@never-synced")
    db.commit()

    response = client.get("/api/v1/connections", headers=auth_headers)

    assert response.status_code == 200
    states_by_username = {
        connection["username"]: connection["health"]["state"]
        for connection in response.json()
    }
    assert states_by_username == {
        "@healthy": "healthy",
        "@degraded": "degraded",
        "@stale": "stale",
        "@failed": "failed",
        "@never-synced": "never_synced",
    }


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
    res = client.get("/api/v1/connections", headers=auth_headers)
    assert len(res.json()) == 0


def test_connections_require_auth(client):
    res = client.get("/api/v1/connections")
    assert res.status_code == 401


def test_instagram_auth_url(client, auth_headers):
    class FakeRedis:
        def setex(self, *args, **kwargs):
            return True

    with patch("app.routers.connections.get_redis", return_value=FakeRedis()):
        res = client.get("/api/v1/connections/instagram/auth-url", headers=auth_headers)

    assert res.status_code == 200
    data = res.json()
    assert "auth_url" in data
    assert "instagram.com/oauth/authorize" in data["auth_url"]


def test_analyze_returns_pipeline_run_id(client, auth_headers, test_connection, db):
    # Analysis now requires credits upfront (P0 jul/2026)
    from app.services.credit_service import grant_pack
    grant_pack(db, test_connection.user_id, 100)
    db.commit()

    with patch("app.tasks.pipeline_tasks.task_analyze_connection.delay") as delay:
        delay.return_value.id = "celery-task-id"
        res = client.post(
            f"/api/v1/connections/{test_connection.id}/analyze",
            headers=auth_headers,
        )

    assert res.status_code == 200
    data = res.json()
    assert data["run_id"]
    assert data["task_id"] == data["run_id"]
    assert data["task_id"] != "celery-task-id"

    run = db.get(PipelineRun, uuid.UUID(data["run_id"]))
    assert run is not None
    assert run.connection_id == test_connection.id
    assert run.run_type == "analyze"
    assert run.celery_task_id == "celery-task-id"


def test_sync_honors_requested_comment_limit_with_apify(
    client,
    auth_headers,
    test_connection,
    db,
):
    """Apify must not silently replace the comment limit chosen by the user."""
    effective_plan_limits = {
        "max_posts": 60,
        "max_comments_per_post": 2000,
    }

    with (
        patch(
            "app.services.plan_service.enforce_sync_limits",
            return_value=effective_plan_limits,
        ),
        patch("app.tasks.pipeline_tasks.task_full_pipeline.delay") as delay,
    ):
        delay.return_value.id = "celery-task-id"
        response = client.post(
            f"/api/v1/connections/{test_connection.id}/sync",
            headers=auth_headers,
            json={
                "max_posts": 100,
                "max_comments_per_post": 50,
                "use_apify_comments": True,
                "comment_sample_mode": "all",
            },
        )

    assert response.status_code == 200
    delay.assert_called_once_with(
        str(test_connection.id),
        str(test_connection.user_id),
        max_posts=60,
        max_comments_per_post=50,
        since_date=None,
        use_apify_comments=True,
        comment_sample_mode="all",
        run_id=response.json()["run_id"],
        include_demographics=False,
    )

    run = db.get(PipelineRun, uuid.UUID(response.json()["run_id"]))
    assert run is not None
    assert run.target_posts == 60


def test_collection_preview_separates_candidates_engagement_and_credit_cap(
    client,
    auth_headers,
    test_connection,
    test_user,
    db,
):
    user, _ = test_user
    test_connection.platform = "instagram"
    test_connection.media_count = 2
    now = datetime.now(timezone.utc)
    db.add_all([
        Post(
            connection_id=test_connection.id,
            platform="instagram",
            platform_post_id="preview-1",
            content_text="preview 1",
            content_clean="preview 1",
            comment_count=50,
            comment_count_api=500,
            published_at=now - timedelta(days=1),
            fetched_at=now - timedelta(hours=1),
        ),
        Post(
            connection_id=test_connection.id,
            platform="instagram",
            platform_post_id="preview-2",
            content_text="preview 2",
            content_clean="preview 2",
            comment_count=25,
            comment_count_api=100,
            published_at=now - timedelta(days=2),
            fetched_at=now - timedelta(hours=1),
        ),
        CreditBalance(
            user_id=user.id,
            plan_credits=200,
            pack_credits=50,
            cycle_start=now,
        ),
    ])
    db.commit()

    common = (
        f"/api/v1/connections/collection-preview?connection_id={test_connection.id}"
        "&max_posts=2&max_comments_per_post=500"
    )
    all_response = client.get(
        f"{common}&comment_selection_mode=all",
        headers=auth_headers,
    )
    engagement_response = client.get(
        f"{common}&comment_selection_mode=engagement",
        headers=auth_headers,
    )

    assert all_response.status_code == 200
    assert engagement_response.status_code == 200
    all_preview = all_response.json()
    engagement_preview = engagement_response.json()

    assert all_preview["found_status"] == "complete"
    assert all_preview["found_known_comments"] == 600
    assert all_preview["estimated_candidate_comments_max"] == 600
    assert all_preview["estimated_selected_comments_max"] == 600
    assert all_preview["estimated_analyzed_comments_max"] == 250
    assert all_preview["estimated_coverage_pct"] == 100.0

    assert engagement_preview["selection_mode"] == "engagement"
    assert engagement_preview["selection_applies_to_profiles"] == 1
    assert engagement_preview["estimated_candidate_comments_max"] == 600
    assert engagement_preview["estimated_selected_comments_max"] == 300
    assert engagement_preview["estimated_analyzed_comments_max"] == 250
    assert engagement_preview["estimated_coverage_pct"] == 50.0
    assert "engagement_is_biased" in engagement_preview["explanation_codes"]
    assert "engagement_does_not_reduce_candidate_fetch" in engagement_preview["explanation_codes"]
    assert engagement_preview["fixed_costs_included"] is False

    future_response = client.get(
        f"{common}&comment_selection_mode=engagement&since_date={date.today() + timedelta(days=1)}",
        headers=auth_headers,
    )
    assert future_response.status_code == 200
    future_preview = future_response.json()
    assert future_preview["found_status"] == "unknown"
    assert future_preview["found_known_comments"] == 0
    assert future_preview["estimated_candidate_comments_max"] == 1000
    assert future_preview["estimated_selected_comments_max"] == 400
    assert "period_applies_to_instagram_only" in future_preview["explanation_codes"]


def test_sync_migrates_legacy_sample_value_to_engagement(
    client,
    auth_headers,
    test_connection,
):
    effective_plan_limits = {
        "max_posts": 5,
        "max_comments_per_post": 500,
    }
    with (
        patch(
            "app.services.plan_service.enforce_sync_limits",
            return_value=effective_plan_limits,
        ),
        patch("app.tasks.pipeline_tasks.task_full_pipeline.delay") as delay,
    ):
        delay.return_value.id = "celery-task-id"
        response = client.post(
            f"/api/v1/connections/{test_connection.id}/sync",
            headers=auth_headers,
            json={
                "max_posts": 1,
                "max_comments_per_post": 10,
                "comment_sample_mode": "sample",
            },
        )

    assert response.status_code == 200
    assert delay.call_args.kwargs["comment_sample_mode"] == "engagement"
