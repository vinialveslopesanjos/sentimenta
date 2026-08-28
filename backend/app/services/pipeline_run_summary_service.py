"""Deterministic, user-facing interpretation of a pipeline execution.

The raw pipeline status is an operational fact and must remain untouched.  It
is not, by itself, a safe product conclusion: a run can be marked
``completed`` after collecting comments while producing zero usable analyses.
This module adds a versioned semantic layer that the UI can translate without
inventing success or hiding preserved historical data.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.models.pipeline_run import PipelineRun


PIPELINE_RUN_SUMMARY_CONTRACT_VERSION = 2


def _count(value: Any) -> int:
    try:
        return max(int(value or 0), 0)
    except (TypeError, ValueError):
        return 0


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _statement(code: str, parameters: Mapping[str, Any]) -> dict[str, Any]:
    return {"code": code, "parameters": dict(parameters)}


def _page_action(code: str, href: str, priority: str = "high") -> dict[str, Any]:
    return {
        "code": code,
        "href": href,
        "priority": priority,
        "target": "page",
    }


def _technical_log_action(run_id: Any) -> dict[str, Any]:
    return {
        "code": "review_partial_run",
        "href": f"#technical-log-{run_id}",
        "priority": "high",
        "target": "technical_log",
    }


def _no_navigation_action(code: str, priority: str = "low") -> dict[str, Any]:
    return {
        "code": code,
        "href": None,
        "priority": priority,
        "target": "none",
    }


def _snapshot_context(snapshot: Mapping[str, Any] | None) -> dict[str, Any]:
    reference = _mapping(snapshot)
    language_policy = _mapping(reference.get("language_policy"))
    next_action = _mapping(language_policy.get("next_action"))
    snapshot_valid_count = _count(reference.get("valid_count"))
    mode = str(language_policy.get("mode") or "").strip().lower()
    return {
        "valid_count": snapshot_valid_count,
        "has_historical_data": snapshot_valid_count > 0 and mode == "historical",
        "next_action": next_action,
    }


def _safe_snapshot_action(
    snapshot_context: Mapping[str, Any],
    *,
    fallback: Mapping[str, Any],
) -> dict[str, Any]:
    candidate = _mapping(snapshot_context.get("next_action"))
    code = str(candidate.get("code") or "").strip()
    href = str(candidate.get("href") or "").strip()
    priority = str(candidate.get("priority") or "").strip()
    if not code or not href.startswith("/dashboard"):
        return dict(fallback)
    return _page_action(
        code,
        href,
        priority if priority in {"low", "medium", "high"} else "high",
    )


def build_pipeline_run_human_summary(
    run: PipelineRun,
    snapshot: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Classify a run and return translatable human-summary semantics."""
    raw_status = str(run.status or "unknown").strip().lower()
    saved_count = _count(run.comments_fetched)
    valid_count = _count(run.comments_analyzed)
    errors_count = _count(run.errors_count)
    remaining_count = max(saved_count - valid_count, 0)
    minimum_backlog_count = max(valid_count - saved_count, 0)
    context = _snapshot_context(snapshot)
    historical_valid_count = _count(context["valid_count"])
    has_historical_data = bool(context["has_historical_data"])
    parameters = {
        "saved_count": saved_count,
        "valid_count": valid_count,
        "remaining_count": remaining_count,
        "minimum_backlog_count": minimum_backlog_count,
        "errors_count": errors_count,
        "historical_valid_count": historical_valid_count,
    }

    if raw_status == "running":
        effective_status = "running"
        reason_code = "execution_running"
        happened_code = "execution_running"
        impact_code = "data_pending"
        next_action = _no_navigation_action("wait_for_completion")
    elif raw_status == "cancelled":
        effective_status = "cancelled"
        reason_code = "execution_cancelled"
        happened_code = "execution_cancelled"
        impact_code = "historical_data_preserved" if has_historical_data else "evaluation_unavailable"
        next_action = _safe_snapshot_action(
            context,
            fallback=_page_action("retry_sync", "/dashboard/connect"),
        )
    elif saved_count > 0 and valid_count == 0:
        # This deliberately takes precedence over the raw ``completed`` state.
        effective_status = "failed"
        reason_code = "zero_valid_analyses"
        happened_code = "collected_without_valid_analysis"
        impact_code = "historical_data_preserved" if has_historical_data else "collected_data_unusable"
        next_action = _safe_snapshot_action(
            context,
            fallback=_page_action("retry_sync", "/dashboard/connect"),
        )
    elif raw_status == "failed":
        effective_status = "failed"
        reason_code = "execution_failed_after_collection" if saved_count or valid_count else "execution_failed_before_collection"
        happened_code = reason_code
        impact_code = "historical_data_preserved" if has_historical_data else "evaluation_unavailable"
        next_action = _safe_snapshot_action(
            context,
            fallback=_page_action("retry_sync", "/dashboard/connect"),
        )
    elif raw_status == "partial" and minimum_backlog_count > 0:
        effective_status = "attention"
        reason_code = "analysis_includes_backlog"
        happened_code = "analysis_includes_backlog"
        impact_code = "backlog_scope_explained"
        next_action = _technical_log_action(run.id)
    elif raw_status == "partial" or (saved_count > 0 and valid_count < saved_count):
        effective_status = "attention"
        reason_code = "partial_analysis"
        happened_code = "partial_analysis"
        impact_code = "partial_basis"
        next_action = _technical_log_action(run.id)
    elif raw_status == "completed" and saved_count == 0 and valid_count == 0:
        effective_status = "attention"
        reason_code = "no_new_comments"
        happened_code = "no_new_comments"
        impact_code = "no_new_evidence"
        next_action = _page_action("review_collection", "/dashboard/connect", "medium")
    elif raw_status == "completed" and minimum_backlog_count > 0:
        effective_status = "success"
        reason_code = "analysis_completed_with_backlog"
        happened_code = "analysis_includes_backlog"
        impact_code = "backlog_scope_explained"
        next_action = _safe_snapshot_action(
            context,
            fallback=_page_action("keep_monitoring", "/dashboard", "low"),
        )
    elif raw_status == "completed":
        effective_status = "success"
        reason_code = "analysis_completed" if str(run.run_type or "") == "analyze" else "collection_completed"
        happened_code = reason_code
        impact_code = "valid_data_available"
        next_action = _safe_snapshot_action(
            context,
            fallback=_page_action("keep_monitoring", "/dashboard", "low"),
        )
    else:
        effective_status = "attention"
        reason_code = "execution_state_unknown"
        happened_code = "execution_state_unknown"
        impact_code = "evaluation_unconfirmed"
        next_action = _technical_log_action(run.id)

    return {
        "contract_version": PIPELINE_RUN_SUMMARY_CONTRACT_VERSION,
        "effective_status": effective_status,
        "reason_code": reason_code,
        "happened": _statement(happened_code, parameters),
        "impact": _statement(impact_code, parameters),
        "next_action": next_action,
        # The run record itself is the technical trace even when no detailed
        # step messages were captured.
        "technical_log_available": True,
    }
