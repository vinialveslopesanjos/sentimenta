"""Deterministic contract tests for immutable analytical snapshots."""

import json
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.models.analysis import CommentAnalysis
from app.models.data_snapshot import DataSnapshot, SnapshotImmutableError
from app.models.pipeline_run import PipelineRun
from app.services.data_snapshot_service import (
    SnapshotContractError,
    capture_user_data_snapshot,
    create_data_snapshot,
    get_latest_data_snapshot,
    snapshot_reference,
    verify_snapshot_integrity,
)
from app.tasks.pipeline_tasks import _capture_terminal_snapshot


NOW = datetime(2026, 8, 26, 12, 0, tzinfo=timezone.utc)


def _minimal_snapshot(db, user_id, **overrides) -> DataSnapshot:
    values = {
        "user_id": user_id,
        "trigger_run_id": None,
        "period_start": NOW - timedelta(days=7),
        "period_end": NOW,
        "last_attempt_at": NOW,
        "last_success_at": NOW,
        "source_platforms": ["youtube"],
        "profiles": [
            {
                "connection_id": str(uuid.uuid4()),
                "platform": "youtube",
                "username": "@fixture",
            }
        ],
        "found_count": None,
        "eligible_count": None,
        "collected_count": 12,
        "saved_count": 10,
        "analyzed_count": 9,
        "valid_count": 8,
        "ignored_count": None,
        "coverage": {
            "status": "unknown",
            "ratio": None,
            "reason_code": "expected_window_not_recorded",
        },
        "health": "healthy",
        "reason_code": "healthy",
        "metrics": {"global": {"avg_score": 7.5, "valid_count": 8}},
        "created_at": NOW,
    }
    values.update(overrides)
    return create_data_snapshot(db, **values)


def test_snapshot_contract_is_complete_and_integrity_verifiable(db, test_user):
    user, _ = test_user

    snapshot = _minimal_snapshot(db, user.id)
    db.commit()
    db.refresh(snapshot)

    assert snapshot.schema_version == 1
    assert snapshot.found_count is None
    assert snapshot.eligible_count is None
    assert snapshot.ignored_count is None
    assert snapshot.source_platforms == ["youtube"]
    assert len(snapshot.content_hash) == 64
    assert verify_snapshot_integrity(snapshot) is True

    reference = snapshot_reference(snapshot)
    assert reference is not None
    assert reference["id"] == snapshot.id
    assert reference["metrics"]["global"]["avg_score"] == 7.5


def test_complete_count_funnel_is_preserved_in_snapshot_references(db, test_user):
    user, _ = test_user
    snapshot = _minimal_snapshot(
        db,
        user.id,
        found_count=15,
        eligible_count=12,
        collected_count=11,
        saved_count=10,
        analyzed_count=9,
        valid_count=8,
        ignored_count=3,
    )

    reference = snapshot_reference(snapshot)
    assert reference is not None
    assert {
        field: reference[field]
        for field in (
            "found_count",
            "eligible_count",
            "collected_count",
            "saved_count",
            "analyzed_count",
            "valid_count",
            "ignored_count",
        )
    } == {
        "found_count": 15,
        "eligible_count": 12,
        "collected_count": 11,
        "saved_count": 10,
        "analyzed_count": 9,
        "valid_count": 8,
        "ignored_count": 3,
    }


def test_snapshot_rejects_invalid_period_and_counts(db, test_user):
    user, _ = test_user

    with pytest.raises(SnapshotContractError, match="period_start"):
        _minimal_snapshot(
            db,
            user.id,
            period_start=NOW,
            period_end=NOW - timedelta(days=1),
        )

    with pytest.raises(SnapshotContractError, match="valid_count"):
        _minimal_snapshot(db, user.id, analyzed_count=2, valid_count=3)

    with pytest.raises(SnapshotContractError, match="saved_count"):
        _minimal_snapshot(db, user.id, saved_count=-1)

    with pytest.raises(SnapshotContractError, match="saved_count"):
        _minimal_snapshot(db, user.id, collected_count=8, saved_count=9)

    with pytest.raises(SnapshotContractError, match="eligible_count"):
        _minimal_snapshot(
            db,
            user.id,
            found_count=10,
            eligible_count=11,
        )

    with pytest.raises(SnapshotContractError, match="ignored_count"):
        _minimal_snapshot(
            db,
            user.id,
            found_count=12,
            eligible_count=10,
            collected_count=10,
            ignored_count=1,
        )


def test_persisted_snapshot_cannot_be_updated(db, test_user):
    user, _ = test_user
    snapshot = _minimal_snapshot(db, user.id)
    db.commit()
    snapshot_id = snapshot.id

    snapshot.health = "failed"
    with pytest.raises(SnapshotImmutableError, match="immutable"):
        db.flush()
    db.rollback()

    stored = db.get(DataSnapshot, snapshot_id)
    assert stored is not None
    assert stored.health == "healthy"
    assert verify_snapshot_integrity(stored) is True


def test_capture_user_snapshot_reconciles_current_database_truth(
    db,
    test_user,
    test_connection,
    test_comments,
):
    user, _ = test_user
    user.plan = "pro"
    test_connection.last_sync_at = NOW - timedelta(hours=2)

    scores = [2.0, 5.0, 7.0, 8.0, 9.0]
    for index, (comment, score) in enumerate(zip(test_comments, scores, strict=True)):
        comment.published_at = NOW - timedelta(days=5 - index)
        comment.status = "processed"
        db.add(
            CommentAnalysis(
                comment_id=comment.id,
                model="fixture-model",
                prompt_version="v1",
                score_0_10=score,
                analyzed_at=NOW - timedelta(hours=2),
            )
        )

    run = PipelineRun(
        user_id=user.id,
        connection_id=test_connection.id,
        run_type="daily_sync",
        status="completed",
        posts_fetched=1,
        comments_fetched=5,
        comments_analyzed=5,
        started_at=NOW - timedelta(hours=2, minutes=10),
        ended_at=NOW - timedelta(hours=2),
        notes=json.dumps(
            {
                "collection": {
                    "mode": "sample",
                    "run_type": "daily_sync",
                    "max_posts": 1,
                    "max_comments_per_post": 5,
                    "since_date": "2026-08-21",
                    "use_apify_comments": False,
                }
            }
        ),
    )
    db.add(run)
    db.commit()

    snapshot = capture_user_data_snapshot(
        db,
        user_id=user.id,
        trigger_run=run,
        now=NOW,
    )
    db.commit()
    db.refresh(snapshot)

    assert snapshot.health == "healthy"
    assert snapshot.reason_code == "healthy"
    assert snapshot.source_platforms == ["youtube"]
    assert snapshot.profiles[0]["connection_id"] == str(test_connection.id)
    assert snapshot.found_count is None
    assert snapshot.eligible_count is None
    assert snapshot.collected_count is None
    assert snapshot.saved_count == 5
    assert snapshot.analyzed_count == 5
    assert snapshot.valid_count == 5
    assert snapshot.ignored_count is None
    assert snapshot.period_start.date().isoformat() == "2026-08-21"
    assert snapshot.period_end.date().isoformat() == "2026-08-25"
    assert snapshot.coverage["status"] == "unknown"
    assert snapshot.coverage["reason_code"] == "expected_window_not_recorded"
    assert snapshot.metrics["global"] == {
        "valid_count": 5,
        "avg_score": 6.2,
        "sentiment_distribution": {
            "positive": 3,
            "neutral": 1,
            "negative": 1,
        },
    }
    assert snapshot.metrics["trigger_run"] == {
        "id": str(run.id),
        "run_type": "daily_sync",
        "status": "completed",
        "operational_comments_fetched": 5,
    }
    assert snapshot.metrics["collection"] == {
        "mode": "sample",
        "run_type": "daily_sync",
        "max_posts": 1,
        "max_comments_per_post": 5,
        "since_date": "2026-08-21",
        "use_apify_comments": False,
        "source": "trigger_run_metadata",
    }
    assert verify_snapshot_integrity(snapshot) is True
    assert get_latest_data_snapshot(db, user_id=user.id).id == snapshot.id


def test_capture_without_profiles_is_explicitly_never_synced(db, test_user):
    user, _ = test_user

    snapshot = capture_user_data_snapshot(db, user_id=user.id, now=NOW)

    assert snapshot.health == "never_synced"
    assert snapshot.reason_code == "no_profiles"
    assert snapshot.profiles == []
    assert snapshot.saved_count == 0
    assert snapshot.coverage["status"] == "none"


def test_snapshot_api_returns_latest_and_owned_detail(client, auth_headers, db, test_user):
    user, _ = test_user
    older = _minimal_snapshot(
        db,
        user.id,
        created_at=NOW - timedelta(hours=1),
        metrics={"global": {"avg_score": 4.0}},
    )
    latest = _minimal_snapshot(
        db,
        user.id,
        created_at=NOW,
        metrics={"global": {"avg_score": 8.0}},
    )
    db.commit()

    response = client.get("/api/v1/data-snapshots/latest", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == str(latest.id)
    assert response.json()["metrics"]["global"]["avg_score"] == 8.0
    assert response.json()["last_attempt_at"] == NOW.isoformat().replace("+00:00", "Z")
    assert response.json()["last_success_at"] == NOW.isoformat().replace("+00:00", "Z")
    assert response.json()["found_count"] is None
    assert response.json()["collected_count"] == 12

    reference = snapshot_reference(latest)
    assert reference is not None
    assert reference["found_count"] is None
    assert reference["collected_count"] == 12
    assert reference["ignored_count"] is None

    response = client.get(
        f"/api/v1/data-snapshots/{older.id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["id"] == str(older.id)


def test_snapshot_api_does_not_expose_another_users_snapshot(
    client,
    auth_headers,
    db,
    test_user,
):
    from app.models.user import User

    user, _ = test_user
    other = User(
        id=uuid.uuid4(),
        email="snapshot-other@example.invalid",
        password_hash="not-used",
        name="Other",
        plan="free",
        email_verified=True,
    )
    db.add(other)
    db.flush()
    snapshot = _minimal_snapshot(db, other.id)
    db.commit()

    response = client.get(
        f"/api/v1/data-snapshots/{snapshot.id}",
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert user.id != other.id


def test_terminal_pipeline_capture_is_best_effort_and_committed(
    db,
    test_user,
    monkeypatch,
):
    user, _ = test_user
    run = PipelineRun(
        user_id=user.id,
        run_type="analyze",
        status="completed",
        ended_at=NOW,
    )
    db.add(run)
    db.commit()

    captured = SimpleNamespace(id=uuid.uuid4())
    capture = Mock(return_value=captured)
    monkeypatch.setattr(
        "app.services.data_snapshot_service.capture_user_data_snapshot",
        capture,
    )

    assert _capture_terminal_snapshot(db, run) is captured
    capture.assert_called_once_with(db, user_id=user.id, trigger_run=run)

    capture.side_effect = RuntimeError("fixture snapshot failure")
    assert _capture_terminal_snapshot(db, run) is None
    db.refresh(run)
    assert run.status == "completed"


def test_all_primary_product_surfaces_reference_the_same_snapshot(
    client,
    auth_headers,
    db,
    test_user,
    test_connection,
    test_comments,
    monkeypatch,
):
    user, _ = test_user
    user.plan = "pro"
    test_connection.last_sync_at = NOW - timedelta(hours=1)

    scores = [2.0, 5.0, 7.0, 8.0, 9.0]
    for index, (comment, score) in enumerate(zip(test_comments, scores, strict=True)):
        comment.published_at = NOW - timedelta(days=index)
        comment.status = "processed"
        db.add(
            CommentAnalysis(
                comment_id=comment.id,
                model="fixture-model",
                prompt_version="v1",
                score_0_10=score,
                analyzed_at=NOW - timedelta(hours=1),
            )
        )

    run = PipelineRun(
        user_id=user.id,
        connection_id=test_connection.id,
        run_type="full",
        status="completed",
        comments_fetched=5,
        comments_analyzed=5,
        ended_at=NOW - timedelta(hours=1),
    )
    db.add(run)
    db.commit()
    snapshot = capture_user_data_snapshot(db, user_id=user.id, trigger_run=run, now=NOW)
    db.commit()

    monkeypatch.setattr(
        "app.routers.dashboard.generate_health_report",
        lambda data_summary, custom_prompt=None: "Relatório sintético da fixture",
    )
    monkeypatch.setattr("app.routers.dashboard.get_redis", lambda: None)

    urls = [
        "/api/v1/dashboard/summary",
        f"/api/v1/dashboard/connection/{test_connection.id}",
        "/api/v1/dashboard/compare?days=30",
        f"/api/v1/dashboard/compare-connections?connection_ids={test_connection.id}&days=3650",
        "/api/v1/dashboard/alerts?days=7&min_analyzed=1&negative_threshold=0",
    ]
    payloads = []
    for url in urls:
        response = client.get(url, headers=auth_headers)
        assert response.status_code == 200, (url, response.text)
        payloads.append(response.json())

    report_response = client.post(
        "/api/v1/dashboard/health-report",
        json={"custom_prompt": None},
        headers=auth_headers,
    )
    assert report_response.status_code == 200, report_response.text
    payloads.append(report_response.json())

    activity_response = client.get("/api/v1/pipeline/runs", headers=auth_headers)
    assert activity_response.status_code == 200, activity_response.text
    activity_payload = activity_response.json()
    assert len(activity_payload) == 1
    payloads.append(activity_payload[0])

    expected_id = str(snapshot.id)
    for payload in payloads:
        reference = payload["snapshot"]
        assert reference["id"] == expected_id
        assert reference["period_start"].startswith("2026-08-22")
        assert reference["period_end"].startswith("2026-08-26")
        assert reference["saved_count"] == 5
        assert reference["valid_count"] == 5
        assert reference["metrics"]["global"]["avg_score"] == 6.2
        assert reference["health"] == "healthy"
        assert reference["language_policy"]["mode"] == "qualified"
        assert reference["language_policy"]["next_action"]["code"] == "review_coverage"
