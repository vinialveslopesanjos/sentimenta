"""Product semantics for human-readable pipeline execution summaries."""

import uuid
from datetime import datetime, timezone

from app.models.pipeline_run import PipelineRun
from app.services.pipeline_run_summary_service import build_pipeline_run_human_summary


NOW = datetime(2026, 8, 26, 12, 0, tzinfo=timezone.utc)


def _run(**overrides) -> PipelineRun:
    values = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "connection_id": uuid.uuid4(),
        "run_type": "full",
        "status": "completed",
        "posts_fetched": 1,
        "comments_fetched": 24,
        "comments_analyzed": 24,
        "llm_calls": 1,
        "errors_count": 0,
        "total_cost_usd": 0.0,
        "started_at": NOW,
        "ended_at": NOW,
    }
    values.update(overrides)
    return PipelineRun(**values)


def test_completed_collection_with_zero_valid_analysis_is_an_effective_failure():
    run = _run(status="completed", comments_fetched=53, comments_analyzed=0)

    summary = build_pipeline_run_human_summary(run)

    assert summary["effective_status"] == "failed"
    assert summary["reason_code"] == "zero_valid_analyses"
    assert summary["happened"] == {
        "code": "collected_without_valid_analysis",
        "parameters": {
            "saved_count": 53,
            "valid_count": 0,
            "remaining_count": 53,
            "minimum_backlog_count": 0,
            "errors_count": 0,
            "historical_valid_count": 0,
        },
    }
    assert summary["impact"]["code"] == "collected_data_unusable"
    assert summary["next_action"] == {
        "code": "retry_sync",
        "href": "/dashboard/connect",
        "priority": "high",
        "target": "page",
    }


def test_failed_attempt_explains_when_historical_data_was_preserved():
    run = _run(status="failed", comments_fetched=0, comments_analyzed=0, errors_count=1)
    snapshot = {
        "valid_count": 24,
        "language_policy": {
            "mode": "historical",
            "next_action": {
                "code": "retry_sync",
                "href": "/dashboard/connect",
                "priority": "high",
            },
        },
    }

    summary = build_pipeline_run_human_summary(run, snapshot)

    assert summary["effective_status"] == "failed"
    assert summary["happened"]["code"] == "execution_failed_before_collection"
    assert summary["impact"]["code"] == "historical_data_preserved"
    assert summary["impact"]["parameters"]["historical_valid_count"] == 24


def test_partial_run_points_to_its_technical_log():
    run = _run(status="partial", comments_fetched=24, comments_analyzed=12, errors_count=12)

    summary = build_pipeline_run_human_summary(run)

    assert summary["effective_status"] == "attention"
    assert summary["reason_code"] == "partial_analysis"
    assert summary["impact"]["parameters"]["remaining_count"] == 12
    assert summary["next_action"] == {
        "code": "review_partial_run",
        "href": f"#technical-log-{run.id}",
        "priority": "high",
        "target": "technical_log",
    }


def test_partial_run_with_backlog_never_presents_analysis_as_a_collection_ratio():
    run = _run(status="partial", comments_fetched=0, comments_analyzed=150, errors_count=1)

    summary = build_pipeline_run_human_summary(run)

    assert summary["contract_version"] == 2
    assert summary["effective_status"] == "attention"
    assert summary["reason_code"] == "analysis_includes_backlog"
    assert summary["happened"]["code"] == "analysis_includes_backlog"
    assert summary["happened"]["parameters"]["minimum_backlog_count"] == 150
    assert summary["impact"]["code"] == "backlog_scope_explained"
    assert summary["next_action"]["target"] == "technical_log"


def test_running_success_empty_and_cancelled_states_stay_explicit():
    running = build_pipeline_run_human_summary(
        _run(status="running", comments_fetched=8, comments_analyzed=3, ended_at=None)
    )
    success = build_pipeline_run_human_summary(
        _run(status="completed", comments_fetched=24, comments_analyzed=24)
    )
    empty = build_pipeline_run_human_summary(
        _run(status="completed", comments_fetched=0, comments_analyzed=0)
    )
    cancelled = build_pipeline_run_human_summary(
        _run(status="cancelled", comments_fetched=0, comments_analyzed=0)
    )

    assert (running["effective_status"], running["impact"]["code"], running["next_action"]["code"]) == (
        "running", "data_pending", "wait_for_completion"
    )
    assert (success["effective_status"], success["impact"]["code"]) == (
        "success", "valid_data_available"
    )
    assert (empty["effective_status"], empty["impact"]["code"], empty["next_action"]["code"]) == (
        "attention", "no_new_evidence", "review_collection"
    )
    assert (cancelled["effective_status"], cancelled["impact"]["code"]) == (
        "cancelled", "evaluation_unavailable"
    )


def test_stale_snapshot_keeps_successful_run_fact_but_recommends_refresh():
    summary = build_pipeline_run_human_summary(
        _run(status="completed", comments_fetched=24, comments_analyzed=24),
        {
            "valid_count": 24,
            "language_policy": {
                "mode": "historical",
                "next_action": {
                    "code": "sync_now",
                    "href": "/dashboard/connect",
                    "priority": "high",
                },
            },
        },
    )

    assert summary["effective_status"] == "success"
    assert summary["reason_code"] == "collection_completed"
    assert summary["next_action"]["code"] == "sync_now"


def test_runs_endpoint_preserves_raw_status_and_adds_the_human_interpretation(
    client,
    db,
    test_user,
    test_connection,
    auth_headers,
):
    user, _ = test_user
    run = PipelineRun(
        id=uuid.uuid4(),
        user_id=user.id,
        connection_id=test_connection.id,
        run_type="full",
        status="completed",
        posts_fetched=1,
        comments_fetched=53,
        comments_analyzed=0,
        llm_calls=0,
        errors_count=0,
        total_cost_usd=0.0,
        started_at=NOW,
        ended_at=NOW,
        notes='{"steps":[{"msg":"53 comentários salvos","ts":"2026-08-26T12:00:00Z"}]}',
    )
    db.add(run)
    db.commit()

    list_response = client.get("/api/v1/pipeline/runs", headers=auth_headers)
    detail_response = client.get(f"/api/v1/pipeline/runs/{run.id}", headers=auth_headers)

    assert list_response.status_code == 200, list_response.text
    assert detail_response.status_code == 200, detail_response.text
    for payload in (list_response.json()[0], detail_response.json()):
        assert payload["status"] == "completed"
        assert payload["human_summary"]["contract_version"] == 2
        assert payload["human_summary"]["effective_status"] == "failed"
        assert payload["human_summary"]["reason_code"] == "zero_valid_analyses"
        assert payload["human_summary"]["happened"]["parameters"]["saved_count"] == 53
        assert payload["human_summary"]["next_action"]["code"] == "retry_sync"
