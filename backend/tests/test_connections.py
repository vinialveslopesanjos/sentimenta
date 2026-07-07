"""Tests for connections endpoints."""

import uuid
from unittest.mock import patch

from app.models.pipeline_run import PipelineRun


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
