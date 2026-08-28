"""P2.1 — testes do custo real por run (Apify + LLM) e créditos por run."""

import uuid

from app.core import apify_cost_tracker
from app.models.social_connection import SocialConnection
from app.services.credit_service import grant_pack


def test_run_cost_accumulator_reset_and_get(monkeypatch):
    # Redis fora do ar não pode impedir a contabilidade por run
    monkeypatch.setattr(apify_cost_tracker, "get_redis", lambda: None)

    apify_cost_tracker.reset_run_cost()
    assert apify_cost_tracker.get_run_cost() == 0.0

    apify_cost_tracker.add_cost(0.5)
    apify_cost_tracker.add_cost(0.25)
    assert apify_cost_tracker.get_run_cost() == 0.75

    apify_cost_tracker.reset_run_cost()
    assert apify_cost_tracker.get_run_cost() == 0.0


def test_add_cost_ignores_non_positive(monkeypatch):
    monkeypatch.setattr(apify_cost_tracker, "get_redis", lambda: None)
    apify_cost_tracker.reset_run_cost()
    apify_cost_tracker.add_cost(0)
    apify_cost_tracker.add_cost(-1.0)
    assert apify_cost_tracker.get_run_cost() == 0.0


def test_daily_sync_persists_apify_cost(db, test_user, monkeypatch):
    """O custo Apify acumulado durante o ingest é gravado na PipelineRun."""
    from tests.conftest import TestSessionLocal

    monkeypatch.setattr("app.tasks.pipeline_tasks.SessionLocal", TestSessionLocal)
    monkeypatch.setattr(apify_cost_tracker, "get_redis", lambda: None)

    user, _ = test_user
    user.plan = "starter"
    db.commit()
    grant_pack(db, user.id, 1000)
    db.commit()

    conn = SocialConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        platform="youtube",
        username="@CostTest",
        status="active",
        auto_sync=True,
    )
    db.add(conn)
    db.commit()

    def fake_ingest(db_, connection, **kwargs):
        # Simula o serviço de ingest registrando custo do Apify
        apify_cost_tracker.add_cost(0.1234)
        return {"posts_fetched": 1, "comments_fetched": 0}

    monkeypatch.setattr("app.tasks.pipeline_tasks._do_ingest", fake_ingest)

    from app.tasks.pipeline_tasks import task_daily_sync

    task_daily_sync.apply(kwargs={"frequency_filter": None}).get()
    db.expire_all()

    from app.models.pipeline_run import PipelineRun

    run = db.query(PipelineRun).filter(PipelineRun.connection_id == conn.id).first()
    assert run is not None
    assert run.apify_cost_usd == 0.1234


def test_list_runs_returns_costs_and_credits(client, auth_headers, test_connection, db):
    """A API expõe apify_cost_usd e créditos consumidos agregados por run."""
    from app.models.pipeline_run import PipelineRun
    from app.services.credit_service import consume_up_to

    user_id = test_connection.user_id
    grant_pack(db, user_id, 100)

    run = PipelineRun(
        user_id=user_id,
        connection_id=test_connection.id,
        run_type="full",
        status="completed",
        total_cost_usd=0.02,
        apify_cost_usd=0.5,
    )
    db.add(run)
    db.commit()

    consume_up_to(
        db, user_id, 30,
        type="consume_comment",
        source="full_pipeline",
        metadata={"pipeline_run_id": str(run.id)},
    )
    db.commit()

    res = client.get("/api/v1/pipeline/runs", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    row = next(r for r in data if r["id"] == str(run.id))
    assert row["apify_cost_usd"] == 0.5
    assert row["total_cost_usd"] == 0.02
    assert row["credits_consumed"] == 30
