"""Deterministic tests for the user-visible connection health contract."""

import uuid
from datetime import datetime, timedelta, timezone

from app.models.pipeline_run import PipelineRun
from app.models.social_connection import SocialConnection
from app.services.connection_health_service import (
    ConnectionHealthState,
    calculate_connection_health,
    freshness_sla_hours_for_plan,
)


NOW = datetime(2026, 8, 26, 12, 0, tzinfo=timezone.utc)


def _connection(**overrides) -> SocialConnection:
    defaults = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "platform": "youtube",
        "username": "@fixture",
        "status": "active",
        "auto_sync": True,
    }
    defaults.update(overrides)
    return SocialConnection(**defaults)


def _run(connection: SocialConnection, *, status: str, age_hours: int, **overrides) -> PipelineRun:
    defaults = {
        "user_id": connection.user_id,
        "connection_id": connection.id,
        "run_type": "daily_sync",
        "status": status,
        "comments_fetched": 10,
        "comments_analyzed": 10,
        "started_at": NOW - timedelta(hours=age_hours, minutes=10),
        "ended_at": NOW - timedelta(hours=age_hours),
    }
    defaults.update(overrides)
    return PipelineRun(**defaults)


def test_sla_follows_plan_frequency():
    assert freshness_sla_hours_for_plan("pro") == 36
    assert freshness_sla_hours_for_plan("free") == 192


def test_next_execution_uses_the_same_schedule_as_celery_beat():
    daily = _connection()
    daily_report = calculate_connection_health(daily, [], plan="pro", now=NOW)

    weekly = _connection()
    weekly_report = calculate_connection_health(weekly, [], plan="free", now=NOW)

    paused = _connection(auto_sync=False)
    paused_report = calculate_connection_health(paused, [], plan="pro", now=NOW)

    assert daily_report.sync_frequency == "daily"
    assert daily_report.next_scheduled_at == datetime(2026, 8, 27, 3, 15, tzinfo=timezone.utc)
    assert weekly_report.sync_frequency == "weekly"
    assert weekly_report.next_scheduled_at == datetime(2026, 8, 31, 3, 25, tzinfo=timezone.utc)
    assert paused_report.next_scheduled_at is None


def test_five_canonical_health_states():
    healthy = _connection(last_sync_at=NOW - timedelta(hours=2))
    healthy_report = calculate_connection_health(
        healthy,
        [_run(healthy, status="completed", age_hours=2)],
        plan="pro",
        now=NOW,
    )

    degraded = _connection(last_sync_at=NOW - timedelta(hours=3))
    degraded_report = calculate_connection_health(
        degraded,
        [
            _run(degraded, status="failed", age_hours=1),
            _run(degraded, status="completed", age_hours=3),
        ],
        plan="pro",
        now=NOW,
    )

    stale = _connection(last_sync_at=NOW - timedelta(hours=40))
    stale_report = calculate_connection_health(
        stale,
        [_run(stale, status="completed", age_hours=40)],
        plan="pro",
        now=NOW,
    )

    failed = _connection(last_sync_at=None)
    failed_report = calculate_connection_health(
        failed,
        [_run(failed, status="failed", age_hours=1)],
        plan="pro",
        now=NOW,
    )

    never_synced = _connection(last_sync_at=None)
    never_report = calculate_connection_health(
        never_synced,
        [],
        plan="pro",
        now=NOW,
    )

    assert healthy_report.state is ConnectionHealthState.HEALTHY
    assert degraded_report.state is ConnectionHealthState.DEGRADED
    assert degraded_report.reason_code == "latest_attempt_failed"
    assert stale_report.state is ConnectionHealthState.STALE
    assert stale_report.reason_code == "last_success_outside_sla"
    assert failed_report.state is ConnectionHealthState.FAILED
    assert never_report.state is ConnectionHealthState.NEVER_SYNCED


def test_completed_run_with_collected_but_zero_analyzed_is_not_success():
    connection = _connection(last_sync_at=None)
    run = _run(
        connection,
        status="completed",
        age_hours=1,
        comments_fetched=53,
        comments_analyzed=0,
    )

    report = calculate_connection_health(connection, [run], plan="pro", now=NOW)

    assert report.state is ConnectionHealthState.FAILED
    assert report.reason_code == "zero_valid_analyses"
    assert report.last_success_at is None
    assert report.last_attempt_saved_count == 53
    assert report.last_attempt_valid_count == 0


def test_completed_empty_run_stays_operationally_healthy_but_exposes_zero_basis():
    connection = _connection(last_sync_at=None)
    run = _run(
        connection,
        status="completed",
        age_hours=1,
        comments_fetched=0,
        comments_analyzed=0,
    )

    report = calculate_connection_health(connection, [run], plan="pro", now=NOW)

    assert report.state is ConnectionHealthState.HEALTHY
    assert report.last_attempt_saved_count == 0
    assert report.last_attempt_valid_count == 0
    assert report.last_success_at is not None


def test_legacy_last_sync_is_degraded_until_verified_by_pipeline():
    connection = _connection(last_sync_at=NOW - timedelta(hours=2))

    report = calculate_connection_health(connection, [], plan="pro", now=NOW)

    assert report.state is ConnectionHealthState.DEGRADED
    assert "legacy_sync_unverified" in report.reason_codes


def test_auto_sync_disabled_is_not_reported_as_healthy():
    connection = _connection(
        auto_sync=False,
        last_sync_at=NOW - timedelta(hours=2),
    )

    report = calculate_connection_health(
        connection,
        [_run(connection, status="completed", age_hours=2)],
        plan="pro",
        now=NOW,
    )

    assert report.state is ConnectionHealthState.DEGRADED
    assert report.reason_code == "auto_sync_disabled"


def test_partial_without_usable_analysis_is_failed():
    connection = _connection(last_sync_at=None)
    run = _run(
        connection,
        status="partial",
        age_hours=1,
        comments_fetched=10,
        comments_analyzed=0,
    )

    report = calculate_connection_health(connection, [run], plan="pro", now=NOW)

    assert report.state is ConnectionHealthState.FAILED
    assert report.reason_code == "latest_attempt_partial"
