"""Product-language policy tests: uncertainty must reduce certainty, not history."""

import pytest

from app.services.trust_language_policy import (
    build_trust_language_policy,
    find_forbidden_claims,
)


@pytest.mark.parametrize(
    ("health", "reason", "coverage", "valid", "pipeline", "mode", "message_key", "next_action"),
    [
        ("healthy", "healthy", "complete", 20, "completed", "current", "current", "keep_monitoring"),
        ("healthy", "healthy", "unknown", 20, "completed", "qualified", "healthy_limited_coverage", "review_coverage"),
        ("degraded", "latest_attempt_failed", "complete", 20, "failed", "historical", "degraded", "retry_sync"),
        ("degraded", "latest_attempt_partial", "complete", 20, "partial", "historical", "partial", "review_partial_run"),
        ("stale", "last_success_outside_sla", "complete", 20, "completed", "historical", "stale", "sync_now"),
        ("failed", "latest_attempt_failed", "complete", 20, "failed", "historical", "failed_with_history", "retry_sync"),
        ("failed", "zero_valid_analyses", "none", 0, "failed", "unavailable", "failed_without_history", "retry_sync"),
        ("never_synced", "never_synced", "none", 0, None, "unavailable", "never_synced", "start_first_sync"),
    ],
)
def test_policy_has_an_explicit_fallback_for_every_trust_state(
    health,
    reason,
    coverage,
    valid,
    pipeline,
    mode,
    message_key,
    next_action,
):
    policy = build_trust_language_policy(
        health=health,
        reason_code=reason,
        coverage={"status": coverage},
        valid_count=valid,
        pipeline_status=pipeline,
    )

    assert policy["policy_version"] == 1
    assert policy["mode"] == mode
    assert policy["message_key"] == message_key
    assert policy["present_tense_allowed"] is (mode == "current")
    assert policy["current_trend_allowed"] is (mode == "current")
    assert policy["no_alerts_claim_allowed"] is (mode == "current")
    assert policy["crisis_claim_allowed"] is (mode == "current")
    assert policy["next_action"]["code"] == next_action


def test_non_current_policy_blocks_present_certainty_and_current_actions():
    policy = build_trust_language_policy(
        health="stale",
        reason_code="last_success_outside_sla",
        coverage={"status": "complete"},
        valid_count=50,
        pipeline_status="completed",
    )

    assert find_forbidden_claims(
        "Tudo limpo hoje: a tendência atual está melhorando. Poste hoje.",
        policy,
    ) == ["present_tense", "current_trend", "all_clear", "current_action"]
    assert find_forbidden_claims(
        "No período observado, 50 comentários válidos tiveram score médio 6,2.",
        policy,
    ) == []


def test_current_policy_does_not_preempt_evidence_based_claims():
    policy = build_trust_language_policy(
        health="healthy",
        reason_code="healthy",
        coverage={"status": "complete"},
        valid_count=50,
        pipeline_status="completed",
    )

    assert policy["forbidden_claims"] == []
    assert find_forbidden_claims("A tendência atual exige atenção.", policy) == []
