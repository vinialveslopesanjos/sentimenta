"""Coverage formula and mutually exclusive alert outcome tests."""

from datetime import datetime, timedelta, timezone

from app.models.analysis import CommentAnalysis
from app.services.alert_coverage_service import (
    ALERTS_FOUND,
    NO_ALERTS_VALID_COVERAGE,
    UNABLE_TO_EVALUATE,
    calculate_window_coverage,
    evaluate_alert_outcome,
)
from app.services.data_snapshot_service import create_data_snapshot


NOW = datetime(2026, 8, 26, 12, 0, tzinfo=timezone.utc)


def _reference(*, health="healthy", no_alerts_allowed=True):
    return {
        "health": health,
        "profiles": [
            {"connection_id": "profile-a"},
            {"connection_id": "profile-b"},
        ],
        "language_policy": {"no_alerts_claim_allowed": no_alerts_allowed},
    }


def test_coverage_formula_requires_time_profiles_and_analysis_to_be_complete():
    coverage = calculate_window_coverage(
        requested_start=NOW - timedelta(days=7),
        requested_end=NOW,
        expected_profile_ids=["profile-a", "profile-b"],
        verified_intervals=[
            {"connection_id": "profile-a", "start": (NOW - timedelta(days=7)).isoformat(), "end": NOW.isoformat()},
            {"connection_id": "profile-b", "start": (NOW - timedelta(days=7)).isoformat(), "end": NOW.isoformat()},
        ],
        eligible_count=40,
        valid_count=40,
    )

    assert coverage["status"] == "complete"
    assert coverage["ratio"] == 1
    assert coverage["temporal_ratio"] == 1
    assert coverage["profile_ratio"] == 1
    assert coverage["analysis_ratio"] == 1
    assert coverage["reason_code"] == "complete_window"


def test_coverage_formula_uses_the_weakest_factor_and_never_infers_missing_data():
    partial = calculate_window_coverage(
        requested_start=NOW - timedelta(days=7),
        requested_end=NOW,
        expected_profile_ids=["profile-a", "profile-b"],
        verified_intervals=[
            {"connection_id": "profile-a", "start": (NOW - timedelta(days=7)).isoformat(), "end": NOW.isoformat()},
            {"connection_id": "profile-b", "start": (NOW - timedelta(days=3)).isoformat(), "end": NOW.isoformat()},
        ],
        eligible_count=40,
        valid_count=32,
    )
    unknown = calculate_window_coverage(
        requested_start=NOW - timedelta(days=7),
        requested_end=NOW,
        expected_profile_ids=["profile-a"],
        verified_intervals=[],
        eligible_count=None,
        valid_count=0,
    )

    assert partial["status"] == "partial"
    assert partial["ratio"] == 0.5  # profile-b is not fully covered
    assert partial["temporal_ratio"] == 0.7143
    assert partial["profile_ratio"] == 0.5
    assert partial["analysis_ratio"] == 0.8
    assert unknown["status"] == "unknown"
    assert unknown["ratio"] is None
    assert unknown["reason_code"] == "no_verified_intervals"


def test_coverage_formula_explains_an_empty_window_as_no_saved_items():
    coverage = calculate_window_coverage(
        requested_start=NOW - timedelta(days=7),
        requested_end=NOW,
        expected_profile_ids=["profile-a"],
        verified_intervals=[
            {"connection_id": "profile-a", "start": (NOW - timedelta(days=7)).isoformat(), "end": NOW.isoformat()},
        ],
        eligible_count=0,
        valid_count=0,
    )

    assert coverage["status"] == "partial"
    assert coverage["analysis_ratio"] == 0
    assert coverage["reason_code"] == "no_saved_items"


def test_alert_outcomes_are_mutually_exclusive_and_unknown_is_not_clean():
    complete = {"status": "complete", "ratio": 1, "reason_code": "complete_window"}
    unknown = {"status": "unknown", "ratio": None, "reason_code": "coverage_not_verified"}

    found = evaluate_alert_outcome(
        alerts_count=1,
        snapshot_reference=_reference(health="stale", no_alerts_allowed=False),
        coverage=unknown,
        analyzed_by_profile={"profile-a": 20},
        min_analyzed=20,
    )
    clean = evaluate_alert_outcome(
        alerts_count=0,
        snapshot_reference=_reference(),
        coverage=complete,
        analyzed_by_profile={"profile-a": 20, "profile-b": 20},
        min_analyzed=20,
    )
    unable = evaluate_alert_outcome(
        alerts_count=0,
        snapshot_reference=_reference(),
        coverage=unknown,
        analyzed_by_profile={"profile-a": 20, "profile-b": 20},
        min_analyzed=20,
    )

    assert found["status"] == ALERTS_FOUND
    assert clean["status"] == NO_ALERTS_VALID_COVERAGE
    assert unable["status"] == UNABLE_TO_EVALUATE
    assert unable["reason_code"] == "coverage_not_verified"


def _api_snapshot(
    db,
    user_id,
    connection_id,
    *,
    coverage,
    valid_count,
    health="healthy",
    reason_code="healthy",
):
    return create_data_snapshot(
        db,
        user_id=user_id,
        trigger_run_id=None,
        period_start=NOW - timedelta(days=7),
        period_end=NOW,
        last_attempt_at=NOW,
        last_success_at=NOW,
        source_platforms=["youtube"],
        profiles=[{"connection_id": str(connection_id), "platform": "youtube", "username": "fixture"}],
        found_count=valid_count,
        eligible_count=valid_count,
        collected_count=valid_count,
        saved_count=valid_count,
        analyzed_count=valid_count,
        valid_count=valid_count,
        ignored_count=0,
        coverage=coverage,
        health=health,
        reason_code=reason_code,
        metrics={"global": {"valid_count": valid_count, "avg_score": 8.0}, "trigger_run": {"status": "completed"}},
        created_at=NOW,
    )


def test_alerts_endpoint_never_reports_a_window_without_data_as_clean(
    client,
    auth_headers,
    db,
    test_user,
    test_connection,
):
    user, _ = test_user
    coverage = {
        "status": "complete",
        "ratio": 1,
        "temporal_ratio": 1,
        "profile_ratio": 1,
        "analysis_ratio": 1,
        "expected_period_start": (datetime.now(timezone.utc) - timedelta(days=8)).isoformat(),
        "expected_period_end": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        "reason_code": "complete_window",
    }
    _api_snapshot(db, user.id, test_connection.id, coverage=coverage, valid_count=0)
    db.commit()

    response = client.get(
        "/api/v1/dashboard/alerts?days=7&min_analyzed=1&negative_threshold=0.9",
        headers=auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["alerts"] == []
    assert payload["evaluation"]["status"] == UNABLE_TO_EVALUATE
    assert payload["evaluation"]["reason_code"] == "insufficient_valid_analyses"


def test_alerts_endpoint_can_prove_no_alerts_only_with_complete_coverage(
    client,
    auth_headers,
    db,
    test_user,
    test_connection,
    test_comments,
):
    user, _ = test_user
    now = datetime.now(timezone.utc)
    for comment in test_comments:
        comment.published_at = now - timedelta(days=1)
        comment.status = "processed"
        db.add(
            CommentAnalysis(
                comment_id=comment.id,
                model="fixture-model",
                prompt_version="v1",
                score_0_10=8.0,
                analyzed_at=now,
            )
        )
    coverage = {
        "status": "complete",
        "ratio": 1,
        "temporal_ratio": 1,
        "profile_ratio": 1,
        "analysis_ratio": 1,
        "expected_period_start": (now - timedelta(days=8)).isoformat(),
        "expected_period_end": (now + timedelta(minutes=5)).isoformat(),
        "reason_code": "complete_window",
    }
    _api_snapshot(db, user.id, test_connection.id, coverage=coverage, valid_count=5)
    db.commit()

    response = client.get(
        "/api/v1/dashboard/alerts?days=7&min_analyzed=1&negative_threshold=0.9",
        headers=auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["alerts"] == []
    assert payload["evaluation"]["status"] == NO_ALERTS_VALID_COVERAGE
    assert payload["evaluation"]["reason_code"] == "evaluated_without_alerts"


def test_alerts_endpoint_reports_interrupted_monitoring_when_snapshot_is_stale(
    client,
    auth_headers,
    db,
    test_user,
    test_connection,
    test_comments,
):
    user, _ = test_user
    now = datetime.now(timezone.utc)
    for comment in test_comments:
        comment.published_at = now - timedelta(days=1)
        comment.status = "processed"
        db.add(
            CommentAnalysis(
                comment_id=comment.id,
                model="fixture-model",
                prompt_version="v1",
                score_0_10=8.0,
                analyzed_at=now,
            )
        )
    coverage = {
        "status": "complete",
        "ratio": 1,
        "temporal_ratio": 1,
        "profile_ratio": 1,
        "analysis_ratio": 1,
        "expected_period_start": (now - timedelta(days=8)).isoformat(),
        "expected_period_end": (now + timedelta(minutes=5)).isoformat(),
        "reason_code": "complete_window",
    }
    _api_snapshot(
        db,
        user.id,
        test_connection.id,
        coverage=coverage,
        valid_count=5,
        health="stale",
        reason_code="refresh_overdue",
    )
    db.commit()

    response = client.get(
        "/api/v1/dashboard/alerts?days=7&min_analyzed=1&negative_threshold=0.9",
        headers=auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["alerts"] == []
    assert payload["snapshot"]["health"] == "stale"
    assert payload["evaluation"]["status"] == UNABLE_TO_EVALUATE
    assert payload["evaluation"]["reason_code"] == "data_health_not_healthy"
