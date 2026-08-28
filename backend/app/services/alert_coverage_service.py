"""Coverage math and the three mutually exclusive alert evaluation outcomes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Sequence


ALERTS_FOUND = "alerts_found"
NO_ALERTS_VALID_COVERAGE = "no_alerts_valid_coverage"
UNABLE_TO_EVALUATE = "unable_to_evaluate"


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return _aware(value)
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return _aware(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        return None


def _union_seconds(intervals: Sequence[tuple[datetime, datetime]]) -> float:
    if not intervals:
        return 0.0
    ordered = sorted(intervals, key=lambda pair: pair[0])
    merged: list[list[datetime]] = []
    for start, end in ordered:
        if not merged or start > merged[-1][1]:
            merged.append([start, end])
        elif end > merged[-1][1]:
            merged[-1][1] = end
    return sum((end - start).total_seconds() for start, end in merged)


def calculate_window_coverage(
    *,
    requested_start: datetime,
    requested_end: datetime,
    expected_profile_ids: Sequence[str],
    verified_intervals: Sequence[Mapping[str, Any]],
    eligible_count: int | None,
    valid_count: int | None,
) -> dict[str, Any]:
    """Calculate the minimum of temporal, profile and analysis coverage."""
    start = _aware(requested_start)
    end = _aware(requested_end)
    if start >= end:
        raise ValueError("requested_start must be before requested_end")

    profiles = list(dict.fromkeys(str(profile_id) for profile_id in expected_profile_ids if profile_id))
    requested_seconds = (end - start).total_seconds()
    intervals_by_profile: dict[str, list[tuple[datetime, datetime]]] = {
        profile_id: [] for profile_id in profiles
    }
    for raw in verified_intervals:
        profile_id = str(raw.get("connection_id") or "")
        if profile_id not in intervals_by_profile:
            continue
        interval_start = _parse_datetime(raw.get("start"))
        interval_end = _parse_datetime(raw.get("end"))
        if interval_start is None or interval_end is None:
            continue
        clipped_start = max(start, interval_start)
        clipped_end = min(end, interval_end)
        if clipped_start < clipped_end:
            intervals_by_profile[profile_id].append((clipped_start, clipped_end))

    if not profiles:
        temporal_ratio = None
        profile_ratio = 0.0
    else:
        covered_seconds_by_profile = {
            profile_id: _union_seconds(intervals)
            for profile_id, intervals in intervals_by_profile.items()
        }
        temporal_ratio = min(
            sum(covered_seconds_by_profile.values()) / (requested_seconds * len(profiles)),
            1.0,
        )
        fully_covered = sum(
            1 for seconds in covered_seconds_by_profile.values()
            if seconds >= requested_seconds
        )
        profile_ratio = fully_covered / len(profiles)

    if eligible_count is None or valid_count is None:
        analysis_ratio = None
    elif eligible_count <= 0:
        analysis_ratio = 0.0
    else:
        analysis_ratio = min(valid_count / eligible_count, 1.0)

    factors = [temporal_ratio, profile_ratio, analysis_ratio]
    ratio = min(factors) if all(factor is not None for factor in factors) else None
    complete = ratio == 1.0
    if complete:
        reason_code = "complete_window"
        status = "complete"
    elif not verified_intervals:
        reason_code = "no_verified_intervals"
        status = "unknown"
    elif analysis_ratio is None:
        reason_code = "analysis_denominator_unknown"
        status = "unknown"
    elif eligible_count == 0:
        reason_code = "no_saved_items"
        status = "partial"
    elif analysis_ratio < 1:
        reason_code = "analysis_incomplete"
        status = "partial"
    elif profile_ratio < 1:
        reason_code = "profiles_not_fully_covered"
        status = "partial"
    else:
        reason_code = "time_window_not_fully_covered"
        status = "partial"

    return {
        "status": status,
        "ratio": round(ratio, 4) if ratio is not None else None,
        "temporal_ratio": round(temporal_ratio, 4) if temporal_ratio is not None else None,
        "profile_ratio": round(profile_ratio, 4),
        "analysis_ratio": round(analysis_ratio, 4) if analysis_ratio is not None else None,
        "requested_period_start": start.isoformat(),
        "requested_period_end": end.isoformat(),
        "expected_profiles": len(profiles),
        "reason_code": reason_code,
    }


def coverage_for_requested_window(
    coverage: Mapping[str, Any] | None,
    *,
    requested_start: datetime,
    requested_end: datetime,
    expected_profile_ids: Sequence[str],
    eligible_count: int | None,
    valid_count: int | None,
) -> dict[str, Any]:
    raw = dict(coverage or {})
    intervals = raw.get("verified_intervals")
    if isinstance(intervals, list) and intervals:
        return calculate_window_coverage(
            requested_start=requested_start,
            requested_end=requested_end,
            expected_profile_ids=expected_profile_ids,
            verified_intervals=intervals,
            eligible_count=eligible_count,
            valid_count=valid_count,
        )

    # A precomputed complete window is accepted only if its recorded bounds
    # fully contain the requested window and every factor is explicitly 1.
    expected_start = _parse_datetime(raw.get("expected_period_start"))
    expected_end = _parse_datetime(raw.get("expected_period_end"))
    factors = (
        raw.get("temporal_ratio"),
        raw.get("profile_ratio"),
        raw.get("analysis_ratio"),
    )
    if (
        raw.get("status") == "complete"
        and raw.get("ratio") == 1
        and all(factor == 1 for factor in factors)
        and expected_start is not None
        and expected_end is not None
        and expected_start <= _aware(requested_start)
        and expected_end >= _aware(requested_end)
    ):
        return {
            **raw,
            "status": "complete",
            "ratio": 1.0,
            "requested_period_start": _aware(requested_start).isoformat(),
            "requested_period_end": _aware(requested_end).isoformat(),
            "reason_code": "complete_window",
        }

    return {
        **raw,
        "status": "unknown" if raw.get("status") in {None, "unknown"} else "partial",
        "ratio": raw.get("ratio"),
        "requested_period_start": _aware(requested_start).isoformat(),
        "requested_period_end": _aware(requested_end).isoformat(),
        "reason_code": raw.get("reason_code") or "coverage_not_verified",
    }


def evaluate_alert_outcome(
    *,
    alerts_count: int,
    snapshot_reference: Mapping[str, Any] | None,
    coverage: Mapping[str, Any],
    analyzed_by_profile: Mapping[str, int],
    min_analyzed: int,
) -> dict[str, Any]:
    """Return exactly one alert outcome without converting unknown into clean."""
    evaluated_count = sum(max(int(count), 0) for count in analyzed_by_profile.values())
    if alerts_count > 0:
        return {
            "status": ALERTS_FOUND,
            "reason_code": "threshold_exceeded",
            "coverage": dict(coverage),
            "evaluated_count": evaluated_count,
            "min_analyzed_per_profile": min_analyzed,
        }

    if snapshot_reference is None:
        reason_code = "no_snapshot"
    elif not snapshot_reference.get("profiles") and not analyzed_by_profile:
        reason_code = "no_profiles"
    elif snapshot_reference.get("health") != "healthy":
        reason_code = "data_health_not_healthy"
    elif coverage.get("status") != "complete" or coverage.get("ratio") != 1:
        reason_code = coverage.get("reason_code") or "coverage_not_verified"
    else:
        expected_profile_ids = [
            str(profile.get("connection_id"))
            for profile in snapshot_reference.get("profiles", [])
            if profile.get("connection_id")
        ]
        underpowered = [
            profile_id for profile_id in expected_profile_ids
            if analyzed_by_profile.get(profile_id, 0) < min_analyzed
        ]
        if underpowered or not expected_profile_ids:
            reason_code = "insufficient_valid_analyses"
        elif not snapshot_reference.get("language_policy", {}).get("no_alerts_claim_allowed", False):
            reason_code = "language_policy_blocks_current_claim"
        else:
            return {
                "status": NO_ALERTS_VALID_COVERAGE,
                "reason_code": "evaluated_without_alerts",
                "coverage": dict(coverage),
                "evaluated_count": evaluated_count,
                "min_analyzed_per_profile": min_analyzed,
            }

    return {
        "status": UNABLE_TO_EVALUATE,
        "reason_code": reason_code,
        "coverage": dict(coverage),
        "evaluated_count": evaluated_count,
        "min_analyzed_per_profile": min_analyzed,
    }
