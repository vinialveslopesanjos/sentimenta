"""Creation, aggregation and integrity checks for immutable data snapshots."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Mapping, Sequence

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.analysis import CommentAnalysis
from app.models.comment import Comment
from app.models.data_snapshot import DataSnapshot
from app.models.pipeline_run import PipelineRun
from app.models.social_connection import SocialConnection
from app.models.user import User
from app.services.connection_health_service import (
    ConnectionHealthReport,
    ConnectionHealthState,
    build_connection_health_map,
)
from app.utils.queries import latest_analysis_subquery
from app.services.trust_language_policy import build_trust_language_policy


SNAPSHOT_SCHEMA_VERSION = 1
COUNT_FIELDS = (
    "found_count",
    "eligible_count",
    "collected_count",
    "saved_count",
    "analyzed_count",
    "valid_count",
    "ignored_count",
)
CANONICAL_HEALTH_STATES = frozenset(state.value for state in ConnectionHealthState)


class SnapshotContractError(ValueError):
    pass


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _iso(value: datetime | None) -> str | None:
    aware = _aware(value)
    return aware.isoformat() if aware else None


def _json_default(value: Any):
    if isinstance(value, datetime):
        return _iso(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    raise TypeError(f"Unsupported snapshot value: {type(value).__name__}")


def _json_safe(value: Any) -> Any:
    try:
        encoded = json.dumps(
            value,
            default=_json_default,
            ensure_ascii=False,
            sort_keys=True,
            allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        raise SnapshotContractError(f"Snapshot payload is not valid JSON: {exc}") from exc
    return json.loads(encoded)


def _content_payload(snapshot: DataSnapshot) -> dict[str, Any]:
    return {
        "schema_version": snapshot.schema_version,
        "user_id": str(snapshot.user_id),
        "trigger_run_id": str(snapshot.trigger_run_id) if snapshot.trigger_run_id else None,
        "period_start": _iso(snapshot.period_start),
        "period_end": _iso(snapshot.period_end),
        "last_attempt_at": _iso(snapshot.last_attempt_at),
        "last_success_at": _iso(snapshot.last_success_at),
        "source_platforms": snapshot.source_platforms,
        "profiles": snapshot.profiles,
        **{field: getattr(snapshot, field) for field in COUNT_FIELDS},
        "coverage": snapshot.coverage,
        "health": snapshot.health,
        "reason_code": snapshot.reason_code,
        "metrics": snapshot.metrics,
        "created_at": _iso(snapshot.created_at),
    }


def _hash_payload(payload: Mapping[str, Any]) -> str:
    encoded = json.dumps(
        _json_safe(dict(payload)),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def verify_snapshot_integrity(snapshot: DataSnapshot) -> bool:
    return snapshot.content_hash == _hash_payload(_content_payload(snapshot))


def _validate_counts(counts: Mapping[str, int | None]) -> None:
    for field, value in counts.items():
        if field not in COUNT_FIELDS:
            raise SnapshotContractError(f"Unknown count field: {field}")
        if value is not None and (not isinstance(value, int) or isinstance(value, bool) or value < 0):
            raise SnapshotContractError(f"{field} must be a non-negative integer or null")

    funnel = (
        "found_count",
        "eligible_count",
        "collected_count",
        "saved_count",
        "analyzed_count",
        "valid_count",
    )
    for previous_field, next_field in zip(funnel, funnel[1:]):
        previous = counts.get(previous_field)
        next_value = counts.get(next_field)
        if previous is not None and next_value is not None and next_value > previous:
            raise SnapshotContractError(
                f"{next_field} cannot exceed {previous_field} in the same snapshot scope"
            )

    found = counts.get("found_count")
    eligible = counts.get("eligible_count")
    ignored = counts.get("ignored_count")
    if found is not None and eligible is not None and ignored is not None:
        expected_ignored = found - eligible
        if ignored != expected_ignored:
            raise SnapshotContractError(
                "ignored_count must equal found_count minus eligible_count"
            )


def create_data_snapshot(
    db: Session,
    *,
    snapshot_id: uuid.UUID | None = None,
    user_id: uuid.UUID,
    trigger_run_id: uuid.UUID | None,
    period_start: datetime | None,
    period_end: datetime | None,
    last_attempt_at: datetime | None,
    last_success_at: datetime | None,
    source_platforms: Sequence[str],
    profiles: Sequence[Mapping[str, Any]],
    found_count: int | None,
    eligible_count: int | None,
    collected_count: int | None,
    saved_count: int | None,
    analyzed_count: int | None,
    valid_count: int | None,
    ignored_count: int | None,
    coverage: Mapping[str, Any],
    health: str,
    reason_code: str,
    metrics: Mapping[str, Any],
    created_at: datetime | None = None,
) -> DataSnapshot:
    """Validate and insert one append-only snapshot; caller owns the transaction."""
    start = _aware(period_start)
    end = _aware(period_end)
    if start and end and start > end:
        raise SnapshotContractError("period_start cannot be after period_end")
    if health not in CANONICAL_HEALTH_STATES:
        raise SnapshotContractError(f"Unknown health state: {health}")
    if not reason_code:
        raise SnapshotContractError("reason_code is required")

    counts = {
        "found_count": found_count,
        "eligible_count": eligible_count,
        "collected_count": collected_count,
        "saved_count": saved_count,
        "analyzed_count": analyzed_count,
        "valid_count": valid_count,
        "ignored_count": ignored_count,
    }
    _validate_counts(counts)

    safe_profiles = _json_safe(list(profiles))
    profile_ids = [profile.get("connection_id") for profile in safe_profiles]
    if any(not profile_id for profile_id in profile_ids):
        raise SnapshotContractError("Every profile must include connection_id")
    if len(profile_ids) != len(set(profile_ids)):
        raise SnapshotContractError("Snapshot profiles must be unique by connection_id")

    profile_platforms = {
        str(profile.get("platform", "")).strip().lower()
        for profile in safe_profiles
        if profile.get("platform")
    }
    normalized_platforms = sorted(
        {
            str(platform).strip().lower()
            for platform in source_platforms
            if str(platform).strip()
        }
        | profile_platforms
    )
    safe_profiles.sort(key=lambda profile: str(profile["connection_id"]))

    snapshot_values = dict(
        user_id=user_id,
        trigger_run_id=trigger_run_id,
        schema_version=SNAPSHOT_SCHEMA_VERSION,
        period_start=start,
        period_end=end,
        last_attempt_at=_aware(last_attempt_at),
        last_success_at=_aware(last_success_at),
        source_platforms=normalized_platforms,
        profiles=safe_profiles,
        coverage=_json_safe(dict(coverage)),
        health=health,
        reason_code=reason_code,
        metrics=_json_safe(dict(metrics)),
        created_at=_aware(created_at) or datetime.now(timezone.utc),
        content_hash="",
        **counts,
    )
    if snapshot_id is not None:
        snapshot_values["id"] = snapshot_id
    snapshot = DataSnapshot(**snapshot_values)
    snapshot.content_hash = _hash_payload(_content_payload(snapshot))
    db.add(snapshot)
    db.flush()
    return snapshot


def _aggregate_health(
    connections: Sequence[SocialConnection],
    health_by_connection: Mapping[uuid.UUID, ConnectionHealthReport],
) -> tuple[str, str]:
    if not connections:
        return ConnectionHealthState.NEVER_SYNCED.value, "no_profiles"
    reports = [health_by_connection[connection.id] for connection in connections]
    states = {report.state for report in reports}
    reasons = {report.reason_code for report in reports}
    if len(states) == 1:
        state = next(iter(states))
        reason = next(iter(reasons)) if len(reasons) == 1 else "multiple_profile_reasons"
        return state.value, reason
    if states.issubset({ConnectionHealthState.HEALTHY, ConnectionHealthState.STALE}):
        return ConnectionHealthState.STALE.value, "one_or_more_profiles_stale"
    return ConnectionHealthState.DEGRADED.value, "mixed_profile_health"


def _metric_row(row) -> dict[str, Any]:
    valid_count = int(row.valid_count or 0)
    positive = int(row.positive or 0)
    neutral = int(row.neutral or 0)
    negative = int(row.negative or 0)
    return {
        "valid_count": valid_count,
        "avg_score": round(float(row.avg_score), 2) if row.avg_score is not None else None,
        "sentiment_distribution": {
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
        },
    }


def _collection_metadata(trigger_run: PipelineRun | None) -> dict[str, Any] | None:
    if trigger_run is None:
        return None
    try:
        notes = json.loads(trigger_run.notes) if trigger_run.notes else {}
    except (json.JSONDecodeError, TypeError):
        notes = {}
    raw = notes.get("collection") if isinstance(notes, dict) else None
    if not isinstance(raw, dict):
        derived_mode = {
            "analyze": "analysis_only",
            "daily_sync": "incremental",
        }.get(trigger_run.run_type, "not_recorded")
        return {
            "mode": derived_mode,
            "run_type": trigger_run.run_type,
            "max_posts": trigger_run.target_posts,
            "max_comments_per_post": None,
            "since_date": None,
            "use_apify_comments": None,
            "source": "derived_from_run_type" if derived_mode != "not_recorded" else "not_recorded",
        }

    return {
        "mode": str(raw.get("mode") or "not_recorded"),
        "run_type": str(raw.get("run_type") or trigger_run.run_type),
        "max_posts": raw.get("max_posts"),
        "max_comments_per_post": raw.get("max_comments_per_post"),
        "since_date": raw.get("since_date"),
        "use_apify_comments": raw.get("use_apify_comments"),
        "source": "trigger_run_metadata",
    }


def capture_user_data_snapshot(
    db: Session,
    *,
    user_id: uuid.UUID,
    trigger_run: PipelineRun | None = None,
    now: datetime | None = None,
) -> DataSnapshot:
    """Capture current analytical truth for a user after a terminal pipeline event."""
    captured_at = _aware(now) or datetime.now(timezone.utc)
    user = db.get(User, user_id)
    if user is None:
        raise SnapshotContractError(f"User {user_id} not found")

    connections = (
        db.query(SocialConnection)
        .filter(SocialConnection.user_id == user_id)
        .order_by(SocialConnection.id)
        .all()
    )
    connection_ids = [connection.id for connection in connections]
    health_by_connection = build_connection_health_map(
        db,
        connections,
        user_id=user_id,
        plan=user.plan,
        now=captured_at,
    )
    health, reason_code = _aggregate_health(connections, health_by_connection)

    reports = [health_by_connection[connection.id] for connection in connections]
    attempts = [report.last_attempt_at for report in reports if report.last_attempt_at]
    successes = [report.last_success_at for report in reports if report.last_success_at]
    last_attempt_at = max(attempts) if attempts else None
    # A multi-profile snapshot is only as fresh as its oldest included source.
    last_success_at = (
        min(successes)
        if reports and len(successes) == len(reports)
        else None
    )

    profiles = [
        {
            "connection_id": str(connection.id),
            "platform": connection.platform,
            "username": connection.username,
            "health": health_by_connection[connection.id].state.value,
            "reason_code": health_by_connection[connection.id].reason_code,
            "last_attempt_at": _iso(health_by_connection[connection.id].last_attempt_at),
            "last_success_at": _iso(health_by_connection[connection.id].last_success_at),
        }
        for connection in connections
    ]

    period_start = None
    period_end = None
    saved_count = 0
    analyzed_count = 0
    valid_count = 0
    global_metrics = {
        "valid_count": 0,
        "avg_score": None,
        "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
    }
    by_profile: list[dict[str, Any]] = []

    if connection_ids:
        period_start, period_end = (
            db.query(
                func.min(func.coalesce(Comment.published_at, Comment.created_at)),
                func.max(func.coalesce(Comment.published_at, Comment.created_at)),
            )
            .filter(Comment.connection_id.in_(connection_ids))
            .one()
        )
        saved_count = int(
            db.query(func.count(Comment.id))
            .filter(Comment.connection_id.in_(connection_ids))
            .scalar()
            or 0
        )
        analyzed_count = int(
            db.query(func.count(func.distinct(CommentAnalysis.comment_id)))
            .join(Comment, Comment.id == CommentAnalysis.comment_id)
            .filter(Comment.connection_id.in_(connection_ids))
            .scalar()
            or 0
        )

        latest_analysis = latest_analysis_subquery()
        metric_columns = (
            func.count(latest_analysis.c.id).label("valid_count"),
            func.avg(latest_analysis.c.score_0_10).label("avg_score"),
            func.sum(case((latest_analysis.c.score_0_10 > 6, 1), else_=0)).label("positive"),
            func.sum(case((latest_analysis.c.score_0_10.between(4, 6), 1), else_=0)).label("neutral"),
            func.sum(case((latest_analysis.c.score_0_10 < 4, 1), else_=0)).label("negative"),
        )
        global_row = (
            db.query(*metric_columns)
            .join(Comment, Comment.id == latest_analysis.c.comment_id)
            .filter(Comment.connection_id.in_(connection_ids))
            .one()
        )
        global_metrics = _metric_row(global_row)
        valid_count = global_metrics["valid_count"]

        profile_rows = (
            db.query(Comment.connection_id, *metric_columns)
            .join(latest_analysis, latest_analysis.c.comment_id == Comment.id)
            .filter(Comment.connection_id.in_(connection_ids))
            .group_by(Comment.connection_id)
            .all()
        )
        metrics_by_connection = {
            row.connection_id: _metric_row(row)
            for row in profile_rows
        }
        for connection in connections:
            by_profile.append(
                {
                    "connection_id": str(connection.id),
                    "platform": connection.platform,
                    "username": connection.username,
                    **metrics_by_connection.get(
                        connection.id,
                        {
                            "valid_count": 0,
                            "avg_score": None,
                            "sentiment_distribution": {
                                "positive": 0,
                                "neutral": 0,
                                "negative": 0,
                            },
                        },
                    ),
                }
            )

    observed_start = _iso(period_start)
    observed_end = _iso(period_end)
    coverage = {
        "status": "none" if saved_count == 0 else "unknown",
        "ratio": None,
        "temporal_ratio": None,
        "profile_ratio": None,
        "analysis_ratio": None,
        "expected_period_start": None,
        "expected_period_end": None,
        "observed_period_start": observed_start,
        "observed_period_end": observed_end,
        "expected_profiles": len(connections),
        "evaluated_profiles": len([metric for metric in by_profile if metric["valid_count"] > 0]),
        "verified_intervals": [],
        "reason_code": "no_saved_items" if saved_count == 0 else "expected_window_not_recorded",
    }
    # `trigger_run.comments_fetched` is scoped to one operational execution,
    # while this snapshot aggregates the retained analytical data for every
    # included profile. Mixing those denominators would create a false funnel.
    # Keep collection unknown until the provider adapters instrument all seven
    # stages in this exact snapshot scope.
    trigger_run_collected_count = None
    if trigger_run and trigger_run.run_type in {"full", "daily_sync", "sync"}:
        trigger_run_collected_count = int(trigger_run.comments_fetched or 0)
    collected_count = None

    metrics = {
        "global": global_metrics,
        "by_profile": by_profile,
        "trigger_run": {
            "id": str(trigger_run.id),
            "run_type": trigger_run.run_type,
            "status": trigger_run.status,
            "operational_comments_fetched": trigger_run_collected_count,
        } if trigger_run else None,
        "collection": _collection_metadata(trigger_run),
        "count_provenance": {
            "found_count": "not_instrumented",
            "eligible_count": "not_instrumented",
            "collected_count": "not_instrumented_in_snapshot_scope",
            "saved_count": "comments rows in snapshot scope",
            "analyzed_count": "distinct comments with any analysis attempt",
            "valid_count": "latest scored analysis per comment",
            "ignored_count": "not_instrumented",
        },
    }

    return create_data_snapshot(
        db,
        user_id=user_id,
        trigger_run_id=trigger_run.id if trigger_run else None,
        period_start=period_start,
        period_end=period_end,
        last_attempt_at=last_attempt_at,
        last_success_at=last_success_at,
        source_platforms=[connection.platform for connection in connections],
        profiles=profiles,
        found_count=None,
        eligible_count=None,
        collected_count=collected_count,
        saved_count=saved_count,
        analyzed_count=analyzed_count,
        valid_count=valid_count,
        ignored_count=None,
        coverage=coverage,
        health=health,
        reason_code=reason_code,
        metrics=metrics,
        created_at=captured_at,
    )


def get_latest_data_snapshot(db: Session, *, user_id: uuid.UUID) -> DataSnapshot | None:
    return (
        db.query(DataSnapshot)
        .filter(DataSnapshot.user_id == user_id)
        .order_by(DataSnapshot.created_at.desc(), DataSnapshot.id.desc())
        .first()
    )


def snapshot_reference(snapshot: DataSnapshot | None) -> dict[str, Any] | None:
    if snapshot is None:
        return None
    trigger_run = (snapshot.metrics or {}).get("trigger_run") or {}
    language_policy = build_trust_language_policy(
        health=snapshot.health,
        reason_code=snapshot.reason_code,
        coverage=snapshot.coverage,
        valid_count=snapshot.valid_count,
        pipeline_status=trigger_run.get("status"),
    )
    return {
        "id": snapshot.id,
        "schema_version": snapshot.schema_version,
        "source_platforms": snapshot.source_platforms,
        "profiles": snapshot.profiles,
        "period_start": _aware(snapshot.period_start),
        "period_end": _aware(snapshot.period_end),
        "last_attempt_at": _aware(snapshot.last_attempt_at),
        "last_success_at": _aware(snapshot.last_success_at),
        "found_count": snapshot.found_count,
        "eligible_count": snapshot.eligible_count,
        "collected_count": snapshot.collected_count,
        "saved_count": snapshot.saved_count,
        "analyzed_count": snapshot.analyzed_count,
        "valid_count": snapshot.valid_count,
        "ignored_count": snapshot.ignored_count,
        "coverage": snapshot.coverage,
        "health": snapshot.health,
        "reason_code": snapshot.reason_code,
        "metrics": snapshot.metrics,
        "content_hash": snapshot.content_hash,
        "created_at": _aware(snapshot.created_at),
        "language_policy": language_policy,
    }


def serialize_data_snapshot(snapshot: DataSnapshot | None) -> dict[str, Any] | None:
    if snapshot is None:
        return None
    reference = snapshot_reference(snapshot)
    assert reference is not None
    return {
        "id": snapshot.id,
        "user_id": snapshot.user_id,
        "trigger_run_id": snapshot.trigger_run_id,
        "schema_version": snapshot.schema_version,
        "period_start": _aware(snapshot.period_start),
        "period_end": _aware(snapshot.period_end),
        "last_attempt_at": _aware(snapshot.last_attempt_at),
        "last_success_at": _aware(snapshot.last_success_at),
        "source_platforms": snapshot.source_platforms,
        "profiles": snapshot.profiles,
        "found_count": snapshot.found_count,
        "eligible_count": snapshot.eligible_count,
        "collected_count": snapshot.collected_count,
        "saved_count": snapshot.saved_count,
        "analyzed_count": snapshot.analyzed_count,
        "valid_count": snapshot.valid_count,
        "ignored_count": snapshot.ignored_count,
        "coverage": snapshot.coverage,
        "health": snapshot.health,
        "reason_code": snapshot.reason_code,
        "metrics": snapshot.metrics,
        "content_hash": snapshot.content_hash,
        "created_at": _aware(snapshot.created_at),
        "language_policy": reference["language_policy"],
    }
