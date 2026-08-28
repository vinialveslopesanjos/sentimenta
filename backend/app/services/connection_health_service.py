"""Canonical, deterministic health model for social connections.

The product must not use ``SocialConnection.status`` or ``last_sync_at`` as a
proxy for pipeline health.  ``status`` describes whether a connection is
registered/usable, while health describes whether its user-visible data can be
trusted now.

This module intentionally contains no provider calls.  The calculation is pure
and can be exercised with deterministic fixtures.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Iterable, Sequence

from sqlalchemy.orm import Session

from app.core.sync_schedule import next_scheduled_sync_at
from app.models.pipeline_run import PipelineRun
from app.models.social_connection import SocialConnection
from app.services.plan_service import get_plan_limits


class ConnectionHealthState(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    STALE = "stale"
    FAILED = "failed"
    NEVER_SYNCED = "never_synced"


INGESTION_RUN_TYPES = frozenset({"full", "daily_sync", "sync"})
TERMINAL_FAILURE_STATUSES = frozenset({"failed", "cancelled"})
RUNNING_STALE_AFTER_HOURS = 6

# One missed scheduled run plus an explicit grace period.
FRESHNESS_SLA_HOURS_BY_FREQUENCY = {
    "daily": 36,
    "weekly": 8 * 24,
    "none": 30 * 24,
}


@dataclass(frozen=True)
class ConnectionHealthReport:
    state: ConnectionHealthState
    reason_code: str
    reason_codes: tuple[str, ...]
    freshness_sla_hours: int
    last_attempt_at: datetime | None
    last_attempt_status: str | None
    last_attempt_saved_count: int | None
    last_attempt_valid_count: int | None
    last_success_at: datetime | None
    fresh_until: datetime | None
    data_age_hours: float | None
    is_syncing: bool
    sync_frequency: str
    next_scheduled_at: datetime | None

    def as_dict(self) -> dict:
        return {
            "state": self.state.value,
            "reason_code": self.reason_code,
            "reason_codes": list(self.reason_codes),
            "freshness_sla_hours": self.freshness_sla_hours,
            "last_attempt_at": self.last_attempt_at,
            "last_attempt_status": self.last_attempt_status,
            "last_attempt_saved_count": self.last_attempt_saved_count,
            "last_attempt_valid_count": self.last_attempt_valid_count,
            "last_success_at": self.last_success_at,
            "fresh_until": self.fresh_until,
            "data_age_hours": self.data_age_hours,
            "is_syncing": self.is_syncing,
            "sync_frequency": self.sync_frequency,
            "next_scheduled_at": self.next_scheduled_at,
        }


def sync_frequency_for_plan(plan: str) -> str:
    return str(get_plan_limits(plan).get("sync_frequency", "weekly"))


def freshness_sla_hours_for_plan(plan: str) -> int:
    """Return the freshness SLA implied by the plan's scheduled frequency."""
    frequency = sync_frequency_for_plan(plan)
    return FRESHNESS_SLA_HOURS_BY_FREQUENCY.get(
        frequency,
        FRESHNESS_SLA_HOURS_BY_FREQUENCY["weekly"],
    )


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _run_finished_at(run: PipelineRun) -> datetime:
    return _aware(run.ended_at) or _aware(run.started_at) or datetime.min.replace(tzinfo=timezone.utc)


def _run_started_at(run: PipelineRun) -> datetime:
    return _aware(run.started_at) or datetime.min.replace(tzinfo=timezone.utc)


def _is_usable_completion(run: PipelineRun) -> bool:
    """A completed run that fetched comments but validated none is not success."""
    if run.status != "completed":
        return False
    return not ((run.comments_fetched or 0) > 0 and (run.comments_analyzed or 0) <= 0)


def _dedupe(items: Iterable[str]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(items))


def calculate_connection_health(
    connection: SocialConnection,
    runs: Sequence[PipelineRun],
    *,
    plan: str,
    now: datetime | None = None,
) -> ConnectionHealthReport:
    """Calculate one of the five canonical health states for a connection."""
    now_utc = _aware(now) or datetime.now(timezone.utc)
    sync_frequency = sync_frequency_for_plan(plan)
    sla_hours = freshness_sla_hours_for_plan(plan)

    ingestion_runs = sorted(
        (run for run in runs if run.run_type in INGESTION_RUN_TYPES),
        key=_run_started_at,
        reverse=True,
    )
    latest_attempt = ingestion_runs[0] if ingestion_runs else None
    latest_success = next((run for run in ingestion_runs if _is_usable_completion(run)), None)

    latest_attempt_at = _run_started_at(latest_attempt) if latest_attempt else None
    latest_attempt_status = latest_attempt.status if latest_attempt else None
    latest_attempt_saved_count = max(int(latest_attempt.comments_fetched or 0), 0) if latest_attempt else None
    latest_attempt_valid_count = max(int(latest_attempt.comments_analyzed or 0), 0) if latest_attempt else None
    verified_success_at = _run_finished_at(latest_success) if latest_success else None
    legacy_sync_at = _aware(connection.last_sync_at)
    last_success_at = verified_success_at or legacy_sync_at

    fresh_until = (
        last_success_at + timedelta(hours=sla_hours)
        if last_success_at is not None
        else None
    )
    data_age_hours = (
        round(max((now_utc - last_success_at).total_seconds(), 0) / 3600, 1)
        if last_success_at is not None
        else None
    )

    latest_running_is_stuck = bool(
        latest_attempt
        and latest_attempt.status == "running"
        and latest_attempt_at
        and now_utc - latest_attempt_at > timedelta(hours=RUNNING_STALE_AFTER_HOURS)
    )
    is_syncing = bool(
        latest_attempt
        and latest_attempt.status == "running"
        and not latest_running_is_stuck
    )
    next_scheduled_at = (
        next_scheduled_sync_at(sync_frequency, now=now_utc)
        if connection.status == "active" and connection.auto_sync
        else None
    )

    issues: list[str] = []
    if connection.status != "active":
        issues.append("connection_not_active")
    if not connection.auto_sync:
        issues.append("auto_sync_disabled")
    if latest_attempt:
        if latest_attempt.status in TERMINAL_FAILURE_STATUSES:
            issues.append("latest_attempt_failed")
        elif latest_attempt.status == "partial":
            issues.append("latest_attempt_partial")
        elif latest_running_is_stuck:
            issues.append("sync_stuck")
        elif latest_attempt.status == "completed" and not _is_usable_completion(latest_attempt):
            issues.append("zero_valid_analyses")

    if last_success_at is None:
        if latest_attempt and latest_attempt.status in TERMINAL_FAILURE_STATUSES:
            state = ConnectionHealthState.FAILED
            primary_reason = "latest_attempt_failed"
        elif latest_attempt and latest_attempt.status == "partial":
            has_usable_partial = (latest_attempt.comments_analyzed or 0) > 0
            state = (
                ConnectionHealthState.DEGRADED
                if has_usable_partial
                else ConnectionHealthState.FAILED
            )
            primary_reason = "latest_attempt_partial"
        elif latest_attempt and latest_attempt.status == "completed" and not _is_usable_completion(latest_attempt):
            state = ConnectionHealthState.FAILED
            primary_reason = "zero_valid_analyses"
        else:
            state = ConnectionHealthState.NEVER_SYNCED
            primary_reason = "first_sync_in_progress" if is_syncing else "never_synced"
    elif fresh_until and now_utc > fresh_until:
        state = ConnectionHealthState.STALE
        primary_reason = "last_success_outside_sla"
        issues.insert(0, primary_reason)
    elif latest_success is None:
        # ``last_sync_at`` predates the canonical health contract and may only
        # prove ingestion, not successful analysis.
        state = ConnectionHealthState.DEGRADED
        primary_reason = issues[0] if issues else "legacy_sync_unverified"
        issues.append("legacy_sync_unverified")
    elif issues:
        state = ConnectionHealthState.DEGRADED
        primary_reason = issues[0]
    else:
        state = ConnectionHealthState.HEALTHY
        primary_reason = "healthy"

    return ConnectionHealthReport(
        state=state,
        reason_code=primary_reason,
        reason_codes=_dedupe([primary_reason, *issues]),
        freshness_sla_hours=sla_hours,
        last_attempt_at=latest_attempt_at,
        last_attempt_status=latest_attempt_status,
        last_attempt_saved_count=latest_attempt_saved_count,
        last_attempt_valid_count=latest_attempt_valid_count,
        last_success_at=last_success_at,
        fresh_until=fresh_until,
        data_age_hours=data_age_hours,
        is_syncing=is_syncing,
        sync_frequency=sync_frequency,
        next_scheduled_at=next_scheduled_at,
    )


def build_connection_health_map(
    db: Session,
    connections: Sequence[SocialConnection],
    *,
    user_id,
    plan: str,
    now: datetime | None = None,
) -> dict:
    """Batch-load pipeline runs and calculate health without N+1 queries."""
    if not connections:
        return {}

    connection_ids = [connection.id for connection in connections]
    runs = (
        db.query(PipelineRun)
        .filter(
            PipelineRun.user_id == user_id,
            PipelineRun.connection_id.in_(connection_ids),
            PipelineRun.run_type.in_(INGESTION_RUN_TYPES),
        )
        .order_by(PipelineRun.started_at.desc())
        .all()
    )

    runs_by_connection: dict = defaultdict(list)
    for run in runs:
        runs_by_connection[run.connection_id].append(run)

    return {
        connection.id: calculate_connection_health(
            connection,
            runs_by_connection.get(connection.id, []),
            plan=plan,
            now=now,
        )
        for connection in connections
    }
