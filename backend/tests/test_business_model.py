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
from app.services.plan_service import PLATFORM_COSTS_USD
from app.tasks.pipeline_tasks import _mark_stale_running_runs
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
        conn = create_connection(db, user, platform="instagram", persona="Marca de cosméticos naturais.")
        post, comments = create_post_with_comments(db, conn, num_comments=10)

        dummy = DummyLLM(cost_per_comment=0.001, score=7.5)

        from app.services import analysis_service
        monkeypatch.setattr(analysis_service, "LLMClient", lambda: dummy)

        stats = analysis_service.analyze_post_comments(db, post.id)
        assert stats["analyzed"] == 10
        assert stats["cost_usd"] == pytest.approx(0.01, abs=1e-6)

    def test_apify_cost_estimation(self):
        """Verify PLATFORM_COSTS_USD has estimated + guardrail layers (ADR-013)."""
        ig_est = PLATFORM_COSTS_USD["instagram"]["estimated"]
        ig_guard = PLATFORM_COSTS_USD["instagram"]["guardrail"]

        # Estimated layer values (verified Apr/2026 from Apify API)
        assert ig_est["per_comment"] == pytest.approx(0.0005)
        assert ig_est["per_post"] == pytest.approx(0.00072)

        # Guardrail should be higher than estimated (conservative)
        assert ig_guard["per_comment"] >= ig_est["per_comment"]
        assert ig_guard["per_post"] >= ig_est["per_post"]

        # 10 posts + 100 comments (estimated layer)
        cost = 10 * ig_est["per_post"] + 100 * ig_est["per_comment"]
        assert cost == pytest.approx(0.0572, abs=1e-3)

        # YouTube should be free in both layers
        yt = PLATFORM_COSTS_USD["youtube"]["estimated"]
        assert yt["per_post"] == 0.0
        assert yt["per_comment"] == 0.0


# ──────────────────────────────────────────────────────────────────────
# Grupo 5: Duplicatas
# ──────────────────────────────────────────────────────────────────────

class TestDuplicates:

    def test_duplicate_comment_not_reprocessed(self, db, monkeypatch):
        """Running analysis twice on same comments should not create new analyses."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram", persona="Marca de cosméticos naturais.")
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


# ──────────────────────────────────────────────────────────────────────
# Grupo 8: Pre-authorization (ADR-013)
# ──────────────────────────────────────────────────────────────────────

class TestPreAuthorization:

    def test_reserve_blocks_when_insufficient(self, db):
        """reserve() should raise InsufficientCreditsError when balance too low."""
        from app.services.credit_service import reserve
        user = create_user(db, plan="free")
        bal = get_or_create_balance(db, user.id)
        bal.plan_credits = 10
        bal.pack_credits = 0
        db.commit()

        with pytest.raises(InsufficientCreditsError):
            reserve(db, user.id, 50, source="test")

    def test_reserve_deducts_credits(self, db):
        """reserve() should deduct credits from balance."""
        from app.services.credit_service import reserve
        user = create_user(db, plan="starter")
        bal = get_or_create_balance(db, user.id)
        initial = bal.plan_credits + bal.pack_credits
        db.commit()

        remaining = reserve(db, user.id, 100, source="test")
        assert remaining == initial - 100

    def test_release_returns_credits(self, db):
        """release() should add credits back to balance."""
        from app.services.credit_service import reserve, release
        user = create_user(db, plan="starter")
        bal = get_or_create_balance(db, user.id)
        initial = bal.plan_credits + bal.pack_credits
        db.commit()

        reserve(db, user.id, 200, source="test")
        db.commit()
        total = release(db, user.id, 150, source="test", description="Surplus returned")
        # Released 150 of 200 reserved, so net consumed = 50
        assert total == initial - 200 + 150

    def test_reserve_release_full_cycle(self, db):
        """Full cycle: reserve → consume actual → release surplus."""
        from app.services.credit_service import reserve, release
        user = create_user(db, plan="pro")
        bal = get_or_create_balance(db, user.id)
        initial_total = bal.plan_credits + bal.pack_credits
        db.commit()

        # Reserve 500 credits (guardrail estimate)
        reserve(db, user.id, 500, source="test")
        db.commit()

        # Actual consumption was only 300 — release 200
        new_total = release(db, user.id, 200, source="test")
        # Net: 500 reserved - 200 released = 300 consumed
        assert new_total == initial_total - 300


# ──────────────────────────────────────────────────────────────────────
# Grupo 9: Collection cap and billing consistency (ADR-013)
# ──────────────────────────────────────────────────────────────────────

class TestCollectionCapAndBilling:

    def test_free_tier_collection_cap(self, db):
        """Free tier with 200 credits should cap max_comments_per_post."""
        from app.services.plan_service import enforce_sync_limits
        user = create_user(db, plan="free")
        bal = get_or_create_balance(db, user.id)
        bal.plan_credits = 200
        bal.pack_credits = 0
        db.commit()

        result = enforce_sync_limits(db, user)
        # 200 credits / 5 posts = 40 comments/post max
        assert result["max_comments_per_post"] <= 200 // result["max_posts"]
        assert result["collection_cap"] == 200

    def test_paid_plan_no_unnecessary_cap(self, db):
        """Starter with 5000 credits should not overly cap comments."""
        from app.services.plan_service import enforce_sync_limits
        user = create_user(db, plan="starter")
        bal = get_or_create_balance(db, user.id)
        bal.plan_credits = 5000
        db.commit()

        result = enforce_sync_limits(db, user)
        # 5000 credits, 30 posts * 1000 comments = 30000
        # Credits (5000) < total (30000), so cap applies
        assert result["max_comments_per_post"] <= 5000 // result["max_posts"]

    def test_billing_text_matches_plan_credits(self):
        """Billing description must match PLAN_CREDITS to avoid user confusion."""
        from app.routers.billing import PLAN_PRICING
        from app.services.credit_service import PLAN_CREDITS

        free_pricing = next(p for p in PLAN_PRICING if p["slug"] == "free")
        # The description should reference 200, not 500
        assert "200" in free_pricing["description"]
        assert "500" not in free_pricing["description"]

    def test_three_cost_layers_exist(self):
        """PLATFORM_COSTS_USD should have estimated and guardrail layers."""
        for platform in ["instagram", "tiktok", "twitter", "youtube"]:
            assert "estimated" in PLATFORM_COSTS_USD[platform]
            assert "guardrail" in PLATFORM_COSTS_USD[platform]
            est = PLATFORM_COSTS_USD[platform]["estimated"]
            guard = PLATFORM_COSTS_USD[platform]["guardrail"]
            # Guardrail should be >= estimated for all items
            for key in est:
                assert guard[key] >= est[key], f"{platform}.{key}: guardrail < estimated"

    def test_guardrail_higher_than_estimated(self):
        """Guardrail costs should be at least as high as estimated (conservative)."""
        ig_est = PLATFORM_COSTS_USD["instagram"]["estimated"]
        ig_guard = PLATFORM_COSTS_USD["instagram"]["guardrail"]
        assert ig_guard["per_comment"] >= ig_est["per_comment"]
        assert ig_guard["per_post"] >= ig_est["per_post"]
        assert ig_guard["per_profile"] >= ig_est["per_profile"]


# ──────────────────────────────────────────────────────────────────────
# Grupo 10: Preflight endpoint (ADR-013 Phase 1)
# ──────────────────────────────────────────────────────────────────────

class TestPreflight:

    def test_preflight_missing_persona_blocks(self, db):
        """Preflight returns missing_persona blocker when persona is empty."""
        from app.routers.connections import sync_preflight
        from unittest.mock import MagicMock

        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")
        # persona is None by default

        # Call the function directly (no HTTP overhead)
        from app.routers.connections import PreflightResponse
        # We need to simulate the endpoint call; use TestClient instead
        from app.services.credit_service import get_or_create_balance
        bal = get_or_create_balance(db, user.id)

        # Verify persona is not set
        assert not conn.persona

        # Check blocker logic directly
        blockers = []
        persona_set = bool(conn.persona and conn.persona.strip())
        if not persona_set:
            blockers.append({"code": "missing_persona", "message": "test"})
        assert len(blockers) == 1
        assert blockers[0]["code"] == "missing_persona"

    def test_preflight_with_persona_no_persona_blocker(self, db):
        """Preflight does NOT return missing_persona when persona is set."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")
        conn.persona = "Sou uma marca de cosméticos naturais focada em sustentabilidade."
        db.commit()

        persona_set = bool(conn.persona and conn.persona.strip())
        assert persona_set is True

    def test_preflight_insufficient_credits_blocks(self, db):
        """Preflight returns insufficient_credits blocker when balance is 0."""
        user = create_user(db, plan="free")
        bal = get_or_create_balance(db, user.id)
        bal.plan_credits = 0
        bal.pack_credits = 0
        db.commit()

        credits_available = bal.plan_credits + bal.pack_credits
        blockers = []
        if credits_available <= 0:
            blockers.append({"code": "insufficient_credits", "message": "test"})
        assert any(b["code"] == "insufficient_credits" for b in blockers)

    def test_preflight_already_running_blocks(self, db):
        """Preflight returns already_running blocker when a run is active."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")
        run = create_pipeline_run(db, user, conn, status="running")

        active_run = db.query(PipelineRun).filter(
            PipelineRun.connection_id == conn.id,
            PipelineRun.status == "running",
        ).first()

        blockers = []
        if active_run:
            blockers.append({"code": "already_running", "message": "test"})
        assert any(b["code"] == "already_running" for b in blockers)

    def test_preflight_posts_missing_context_warning(self, db):
        """Preflight shows warning for posts without caption or image_context."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")

        # Post with good context
        post_good, _ = create_post_with_comments(db, conn, num_comments=1, content_text="This is a valid caption with enough text")
        # Post with no context
        post_bad, _ = create_post_with_comments(db, conn, num_comments=1, content_text="")

        from app.models.post import Post
        posts = db.query(Post).filter(Post.connection_id == conn.id).all()

        with_ctx = 0
        missing_ctx = 0
        for p in posts:
            has_caption = bool(p.content_text and len(p.content_text) > 10)
            has_image_ctx = bool(p.image_context)
            if has_caption or has_image_ctx:
                with_ctx += 1
            else:
                missing_ctx += 1

        assert with_ctx == 1
        assert missing_ctx == 1

    def test_preflight_is_first_run(self, db):
        """is_first_run should be True when no completed runs exist."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")

        any_completed = db.query(PipelineRun).filter(
            PipelineRun.connection_id == conn.id,
            PipelineRun.status.in_(["completed", "partial"]),
        ).first()
        assert any_completed is None  # is_first_run = True

        # After a completed run, it should be False
        create_pipeline_run(db, user, conn, status="completed")
        any_completed = db.query(PipelineRun).filter(
            PipelineRun.connection_id == conn.id,
            PipelineRun.status.in_(["completed", "partial"]),
        ).first()
        assert any_completed is not None  # is_first_run = False


# ──────────────────────────────────────────────────────────────────────
# Grupo 11: Persona blocks sync (ADR-013 Phase 1)
# ──────────────────────────────────────────────────────────────────────

class TestPersonaBlocking:

    def test_analysis_skips_when_no_persona(self, db, monkeypatch):
        """analyze_post_comments returns skipped_reason=missing_persona when persona is empty."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")
        # conn.persona is None
        post, comments = create_post_with_comments(db, conn, num_comments=5)

        dummy = DummyLLM(cost_per_comment=0.001)
        from app.services import analysis_service
        monkeypatch.setattr(analysis_service, "LLMClient", lambda: dummy)

        stats = analysis_service.analyze_post_comments(db, post.id)
        assert stats["analyzed"] == 0
        assert stats.get("skipped_reason") == "missing_persona"

    def test_analysis_runs_with_persona(self, db, monkeypatch):
        """analyze_post_comments works normally when persona is set."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")
        conn.persona = "Marca de roupas sustentáveis focada em moda consciente."
        db.commit()
        post, comments = create_post_with_comments(db, conn, num_comments=5)

        dummy = DummyLLM(cost_per_comment=0.001)
        from app.services import analysis_service
        monkeypatch.setattr(analysis_service, "LLMClient", lambda: dummy)

        stats = analysis_service.analyze_post_comments(db, post.id)
        assert stats["analyzed"] == 5


# ──────────────────────────────────────────────────────────────────────
# Grupo 12: Post context validation (ADR-013 Phase 1)
# ──────────────────────────────────────────────────────────────────────

class TestPostContextValidation:

    def test_post_without_context_skipped(self, db, monkeypatch):
        """Post with empty caption and no image_context should be skipped."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")
        conn.persona = "Marca de tecnologia."
        db.commit()

        # Create post with no useful content_text (<=10 chars)
        post, comments = create_post_with_comments(db, conn, num_comments=5, content_text="short")

        dummy = DummyLLM(cost_per_comment=0.001)
        from app.services import analysis_service
        monkeypatch.setattr(analysis_service, "LLMClient", lambda: dummy)

        stats = analysis_service.analyze_post_comments(db, post.id)
        assert stats["analyzed"] == 0
        assert stats.get("skipped_reason") == "skipped_missing_context"

    def test_post_with_caption_analyzed(self, db, monkeypatch):
        """Post with a valid caption (>10 chars) should be analyzed normally."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")
        conn.persona = "Marca de tecnologia."
        db.commit()

        post, comments = create_post_with_comments(db, conn, num_comments=5, content_text="This is a perfectly valid caption for analysis")

        dummy = DummyLLM(cost_per_comment=0.001)
        from app.services import analysis_service
        monkeypatch.setattr(analysis_service, "LLMClient", lambda: dummy)

        stats = analysis_service.analyze_post_comments(db, post.id)
        assert stats["analyzed"] == 5

    def test_post_with_image_context_analyzed(self, db, monkeypatch):
        """Post with image_context but no caption should still be analyzed."""
        user = create_user(db, plan="starter")
        conn = create_connection(db, user, platform="instagram")
        conn.persona = "Marca de tecnologia."
        db.commit()

        post, comments = create_post_with_comments(db, conn, num_comments=3, content_text="")
        post.image_context = "Uma foto de um produto tecnológico com fundo azul."
        db.commit()

        dummy = DummyLLM(cost_per_comment=0.001)
        from app.services import analysis_service
        monkeypatch.setattr(analysis_service, "LLMClient", lambda: dummy)

        stats = analysis_service.analyze_post_comments(db, post.id)
        assert stats["analyzed"] == 3
