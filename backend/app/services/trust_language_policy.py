"""Deterministic language guardrails for uncertain analytical data."""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Mapping


LANGUAGE_POLICY_VERSION = 1
COMPLETE_COVERAGE_STATES = frozenset({"complete", "full", "valid"})

_PHRASES_BY_CLAIM = {
    "present_tense": (
        "hoje",
        "agora",
        "neste momento",
        "today",
        "right now",
    ),
    "current_trend": (
        "tendencia atual",
        "esta melhorando",
        "esta piorando",
        "current trend",
        "is improving",
        "is getting worse",
    ),
    "all_clear": (
        "tudo limpo",
        "nenhum risco",
        "sem risco",
        "all clear",
        "no risk",
    ),
    "crisis": (
        "crise",
        "incidente critico",
        "crisis",
        "critical incident",
    ),
    "current_action": (
        "poste hoje",
        "publique hoje",
        "faca agora",
        "post today",
        "publish today",
        "do this now",
    ),
}


def _normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    unaccented = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", unaccented).strip()


def _coverage_status(coverage: Mapping[str, Any] | None) -> str:
    if not coverage:
        return "unknown"
    value = coverage.get("status")
    return str(value).strip().lower() if value is not None else "unknown"


def build_trust_language_policy(
    *,
    health: str,
    reason_code: str,
    coverage: Mapping[str, Any] | None,
    valid_count: int | None,
    pipeline_status: str | None = None,
) -> dict[str, Any]:
    """Return what the product may claim without overstating the evidence."""
    normalized_health = str(health).strip().lower()
    normalized_reason = str(reason_code).strip().lower()
    normalized_pipeline = str(pipeline_status).strip().lower() if pipeline_status else None
    coverage_status = _coverage_status(coverage)
    has_valid_history = bool(valid_count and valid_count > 0)
    coverage_is_complete = coverage_status in COMPLETE_COVERAGE_STATES

    if normalized_health == "never_synced":
        mode = "unavailable"
        message_key = "never_synced"
    elif normalized_pipeline == "partial" or "partial" in normalized_reason:
        mode = "historical" if has_valid_history else "unavailable"
        message_key = "partial" if has_valid_history else "partial_without_history"
    elif normalized_health == "failed":
        mode = "historical" if has_valid_history else "unavailable"
        message_key = "failed_with_history" if has_valid_history else "failed_without_history"
    elif normalized_health == "stale":
        mode = "historical" if has_valid_history else "unavailable"
        message_key = "stale" if has_valid_history else "stale_without_history"
    elif normalized_health == "degraded":
        mode = "historical" if has_valid_history else "unavailable"
        message_key = "degraded" if has_valid_history else "degraded_without_history"
    elif not has_valid_history:
        mode = "unavailable"
        message_key = "healthy_without_valid_data"
    elif coverage_is_complete:
        mode = "current"
        message_key = "current"
    else:
        mode = "qualified"
        message_key = "healthy_limited_coverage"

    present_tense_allowed = mode == "current"
    forbidden_claims = [] if present_tense_allowed else [
        "present_tense",
        "current_trend",
        "all_clear",
        "crisis",
        "current_action",
    ]
    if mode == "current":
        action_mode = "current_if_supported"
        required_qualifier = None
    elif mode == "qualified":
        action_mode = "exploratory_only"
        required_qualifier = "observed_data_only"
    elif mode == "historical":
        action_mode = "restore_data_first"
        required_qualifier = "historical_only"
    else:
        action_mode = "connect_or_restore_data"
        required_qualifier = "evaluation_unavailable"

    if message_key == "current":
        next_action = {"code": "keep_monitoring", "href": "/dashboard", "priority": "low"}
    elif message_key == "healthy_limited_coverage":
        next_action = {"code": "review_coverage", "href": "/dashboard/logs", "priority": "medium"}
    elif message_key in {"partial", "partial_without_history"}:
        next_action = {"code": "review_partial_run", "href": "/dashboard/logs", "priority": "high"}
    elif message_key in {"stale", "stale_without_history"}:
        next_action = {"code": "sync_now", "href": "/dashboard/connect", "priority": "high"}
    elif message_key in {
        "degraded",
        "degraded_without_history",
        "failed_with_history",
        "failed_without_history",
    }:
        next_action = {"code": "retry_sync", "href": "/dashboard/connect", "priority": "high"}
    elif message_key == "never_synced":
        next_action = {"code": "start_first_sync", "href": "/dashboard/connect", "priority": "high"}
    else:
        next_action = {"code": "run_analysis", "href": "/dashboard/connect", "priority": "high"}

    return {
        "policy_version": LANGUAGE_POLICY_VERSION,
        "mode": mode,
        "message_key": message_key,
        "health": normalized_health,
        "reason_code": normalized_reason,
        "coverage_status": coverage_status,
        "pipeline_status": normalized_pipeline,
        "present_tense_allowed": present_tense_allowed,
        "current_trend_allowed": present_tense_allowed,
        "no_alerts_claim_allowed": present_tense_allowed,
        "crisis_claim_allowed": present_tense_allowed,
        "action_mode": action_mode,
        "required_qualifier": required_qualifier,
        "forbidden_claims": forbidden_claims,
        "next_action": next_action,
    }


def find_forbidden_claims(text: str, policy: Mapping[str, Any]) -> list[str]:
    """Conservatively flag certainty phrases disallowed by a policy result."""
    normalized = _normalize_text(text)
    forbidden = set(policy.get("forbidden_claims") or [])
    matches = []
    for claim, phrases in _PHRASES_BY_CLAIM.items():
        if claim not in forbidden:
            continue
        if any(_normalize_text(phrase) in normalized for phrase in phrases):
            matches.append(claim)
    return matches
