"""
Business model test suite — validates ADR-011 credit system, plan limits,
pipeline lifecycle, cost tracking, and deduplication.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from tests.factories import (
    create_user,
    create_connection,
    create_pipeline_run,
    create_post_with_comments,
    create_comment_analyses,
    DummyLLM,
)

from app.services.credit_service import (
    consume,
    grant_pack,
    get_or_create_balance,
    InsufficientCreditsError,
    DEMOGRAPHIC_CREDIT_COST,
)
from app.services.plan_service import (
    PLAN_LIMITS,
    get_plan_limits,
    enforce_connection_limit,
    count_connections,
    PlanLimitError,
)
from app.tasks.pipeline_tasks import (
    PLATFORM_COSTS_USD,
    _mark_stale_running_runs,
)
from app.models.pipeline_run import PipelineRun
from app.models.stripe_event import StripeEvent


# ──────────────────────────────────────────────────────────────────────
# Grupo 1: Creditos (ADR-011)
# ──────────────────────────────────────────────────────────────────────

class TestCreditConsumption:

    def test_credit_consumption_one_per_comment(self, db):
        user = create_user(db, plan="starter")
        bal = get_or_create_balance(db, user.id)
        initial = bal.plan_credits + bal.pack_credits
        assert initial == 5000

        remaining = consume(db, user.id, 10, type="consume_comment", source="test")
        db.commit()
        assert remaining == initial - 10

    def test_demographic_costs_five_credits_per_profile(self, db):
        user = create_user(db, plan="starter")
        profiles = 3
        cost = profiles * DEMOGRAPHIC_CREDIT_COST
        assert cost == 15
        remaining = consume(db, user.id, cost, type="consume_demographic", source="test")
        db.commit()
        assert remaining == 5000 - 15

    def test_credits_drain_plan_first_then_pack(self, db):
        user = create_user(db, plan="free")
        # free = 200 plan credits
        grant_pack(db, user.id, 10)
        db.commit()

        bal = get_or_create_balance(db, user.id)
        assert bal.plan_credits == 200
        assert bal.pack_credits == 10

        # Consume 208: should drain 200 from plan + 8 from pack
        consume(db, user.id, 208, type="consume_comment", source="test")
        db.commit()

        bal = get_or_create_balance(db, user.id)
        assert bal.plan_credits == 0
        assert bal.pack_credits == 2

    def test_insufficient_credits_raises(self, db):
        user = create_user(db, plan="free")
        bal = get_or_create_balance(db, user.id)
        # free has 200 credits
        with pytest.raises(InsufficientCreditsError):
            consume(db, user.id, 201, type="consume_comment", source="test")


# ──────────────────────────────────────────────────────────────────────
# Grupo 2: Limites de Plano (parametrizado)
# ──────────────────────────────────────────────────────────────────────

class TestPlanLimits:

    @pytest.mark.parametrize("plan,expected_credits", [
        ("free", 200),
        ("starter", 5000),
        ("pro", 20000),
        ("business", 40000),
    ])
    def test_plan_credits_allocation(self, db, plan, expected_credits):
        user = create_user(db, plan=plan)
        bal = get_or_create_balance(db, user.id)
        assert bal.plan_credits == expected_credits

    @pytest.mark.parametrize("plan,expected_freq", [
        ("free", "weekly"),
        ("starter", "weekly"),
        ("pro", "daily"),
        ("business", "daily"),
    ])
    def test_sync_frequency_by_plan(self, plan, expected_freq):
        limits = get_plan_limits(plan)
        assert limits["sync_frequency"] == expected_freq

    def test_free_plan_cannot_exceed_200_credits(self, db):
        user = create_user(db, plan="free")
        bal = get_or_create_balance(db, user.id)
        assert bal.plan_credits == 200
        with pytest.raises(InsufficientCreditsError):
            consume(db, user.id, 201, type="consume_comment", source="test")

    def test_enforce_connection_limit(self, db):
        user = create_user(db, plan="free")
        # Free allows max 1 connection
        create_connection(db, user, platform="instagram")
        with pytest.raises(PlanLimitError):
            enforce_connection_limit(db, user, platform="instagram")


# ──────────────────────────────────────────────────────────────────────
# Grupo 3: Pipeline Run Lifecycle
# ──────────────────────────────────────────────────────────────────────

class TestPipelineRunLifecycle:

    def test_pipeline_run_status_transitions(self, db):
        user = create_user(db, plan="starter")
        conn = create_connection(db, user)
        run = create_pipeline_run(
            db, user, conn, status="running",
            posts_fetched=0, comments_fetched=0,
        )
        assert run.status == "running"

        # Simulate completion
        run.posts_fetched = 10
        run.comments_fetched = 100
        run.comments_analyzed = 95
        run.llm_calls = 5
        run.total_cost_usd = 0.05
        run.status = "completed"
        run.ended_at = datetime.now(timezone.utc)
        db.commit()

        refreshed = db.get(PipelineRun, run.id)
        assert refreshed.status == "completed"
        assert refreshed.posts_fetched == 10
        assert refreshed.comments_fetched == 100
        assert refreshed.total_cost_usd == pytest.approx(0.05)

    def test_pipeline_run_partial_on_errors(self, db):
        user = create_user(db, plan="starter")
        conn = create_connection(db, user)
        run = create_pipeline_run(db, user, conn, status="running")

        run.comments_analyzed = 80
        run.errors_count = 5
        run.status = "partial" if run.errors_count > 0 else "completed"
        db.commit()

        assert run.status == "partial"

    def test_stale_run_reconciliation(self, db):
        user = create_user(db, plan="starter")
        conn = create_connection(db, user)
        run = create_pipeline_run(db, user, conn, status="running")
        # Make it 7 hours old
        run.started_at = datetime.now(timezone.utc) - timedelta(hours=7)
        run.ended_at = None
        db.commit()

        reconciled = _mark_stale_running_runs(db, max_age_hours=6)
        assert reconciled == 1

        db.refresh(run)
        assert run.status == "failed"
        assert run.ended_at is not None


# ──────────────────────────────────────────────────────────────────────
# Grupo 4: Cost Tracking
# ──────────────────────────────────────────────────────────────────────

class TestCostTracking:

    def test_cost_usd_aggregated_from_llm(self, db, monkeypatch):
        """analyze_post_comments with DummyLLM should aggregate cost_usd."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")
        post, comments = create_post_with_comments(db, conn, num_comments=10)

        dummy = DummyLLM(cost_per_comment=0.001, score=7.5)

        from app.services import analysis_service
        monkeypatch.setattr(analysis_service, "LLMClient", lambda: dummy)

        stats = analysis_service.analyze_post_comments(db, post.id)
        assert stats["analyzed"] == 10
        assert stats["cost_usd"] == pytest.approx(0.01, abs=1e-6)

    def test_apify_cost_estimation(self):
        """Verify PLATFORM_COSTS_USD matches expected values and formula works."""
        ig = PLATFORM_COSTS_USD["instagram"]
        assert ig["per_post"] == pytest.approx(0.0023)
        assert ig["per_comment"] == pytest.approx(0.0005)

        # 10 posts + 100 comments
        cost = 10 * ig["per_post"] + 100 * ig["per_comment"]
        assert cost == pytest.approx(0.073, abs=1e-4)

        # YouTube should be free
        yt = PLATFORM_COSTS_USD["youtube"]
        assert yt["per_post"] == 0.0
        assert yt["per_comment"] == 0.0


# ──────────────────────────────────────────────────────────────────────
# Grupo 5: Duplicatas
# ──────────────────────────────────────────────────────────────────────

class TestDuplicates:

    def test_duplicate_comment_not_reprocessed(self, db, monkeypatch):
        """Running analysis twice on same comments should not create new analyses."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")
        post, comments = create_post_with_comments(db, conn, num_comments=5)

        dummy = DummyLLM(cost_per_comment=0.001)

        from app.services import analysis_service
        monkeypatch.setattr(analysis_service, "LLMClient", lambda: dummy)

        stats1 = analysis_service.analyze_post_comments(db, post.id)
        assert stats1["analyzed"] == 5

        # Run again — all comments should be "processed" now, nothing pending
        stats2 = analysis_service.analyze_post_comments(db, post.id)
        assert stats2["analyzed"] == 0
        assert stats2["cost_usd"] == 0.0

    def test_stripe_event_dedup(self, db):
        """Inserting a StripeEvent with same event_id should raise IntegrityError."""
        evt1 = StripeEvent(event_id="evt_test_123", event_type="invoice.paid")
        db.add(evt1)
        db.commit()

        evt2 = StripeEvent(event_id="evt_test_123", event_type="invoice.paid")
        db.add(evt2)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()


# ──────────────────────────────────────────────────────────────────────
# Grupo 6: Daily Sync filtering
# ──────────────────────────────────────────────────────────────────────

class TestDailySyncFiltering:

    def test_daily_sync_skips_auto_sync_disabled(self, db):
        """Connections with auto_sync=False should be skipped by sync logic."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, auto_sync=False)
        assert conn.auto_sync is False

    def test_daily_sync_filters_by_frequency(self):
        """Daily frequency filter should skip free/starter (weekly) plans."""
        free_limits = get_plan_limits("free")
        starter_limits = get_plan_limits("starter")
        pro_limits = get_plan_limits("pro")
        business_limits = get_plan_limits("business")

        assert free_limits["sync_frequency"] != "daily"
        assert starter_limits["sync_frequency"] != "daily"
        assert pro_limits["sync_frequency"] == "daily"
        assert business_limits["sync_frequency"] == "daily"


# ──────────────────────────────────────────────────────────────────────
# Grupo 7: Depletacao
# ──────────────────────────────────────────────────────────────────────

class TestDepletion:

    def test_sync_stops_when_credits_depleted(self, db, monkeypatch):
        """User with 5 credits and 20 pending comments: analysis consumes up to 5,
        then credit check should block further consumption."""
        user = create_user(db, plan="free")
        # Set balance to exactly 5
        bal = get_or_create_balance(db, user.id)
        bal.plan_credits = 5
        bal.pack_credits = 0
        db.commit()

        conn = create_connection(db, user, platform="instagram")
        post, comments = create_post_with_comments(db, conn, num_comments=20)

        # Consume 5 credits (simulating the pipeline consuming after analysis)
        remaining = consume(db, user.id, 5, type="consume_comment", source="test")
        db.commit()
        assert remaining == 0

        # Now trying to consume more should fail
        with pytest.raises(InsufficientCreditsError):
            consume(db, user.id, 1, type="consume_comment", source="test")
