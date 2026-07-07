"""
P0 jul/2026 — testes do ciclo de débito de créditos no pipeline.

Cobre os vazamentos corrigidos:
1. task_analyze_connection debita créditos (antes: análise grátis ilimitada)
2. Análise para quando o saldo esgota no meio (run vira partial)
3. consume_up_to consome parcial sem lançar exceção
4. task_daily_sync pula usuário sem créditos antes de gastar Apify
5. trigger_analyze retorna 402 sem saldo
"""

import uuid
from unittest.mock import patch

import pytest

from app.models.comment import Comment
from app.models.credits import CreditBalance, CreditTransaction
from app.models.pipeline_run import PipelineRun
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.services.credit_service import (
    consume_up_to,
    get_available_credits,
    get_or_create_balance,
    grant_pack,
)


# ─── consume_up_to ───────────────────────────────────────────────────

def test_consume_up_to_partial_drain(db, test_user):
    user, _ = test_user
    grant_pack(db, user.id, 100)
    db.commit()

    consumed = consume_up_to(db, user.id, 150, type="consume_comment", source="test")
    db.commit()

    assert consumed == 100
    assert get_available_credits(db, user.id) == 0

    txn = (
        db.query(CreditTransaction)
        .filter(CreditTransaction.user_id == user.id, CreditTransaction.amount == -100)
        .first()
    )
    assert txn is not None


def test_consume_up_to_zero_balance_returns_zero(db, test_user):
    user, _ = test_user
    get_or_create_balance(db, user.id)  # free = 0 créditos
    db.commit()

    consumed = consume_up_to(db, user.id, 10, type="consume_comment", source="test")
    assert consumed == 0
    assert get_available_credits(db, user.id) == 0


def test_consume_up_to_full_amount(db, test_user):
    user, _ = test_user
    grant_pack(db, user.id, 500)
    db.commit()

    consumed = consume_up_to(db, user.id, 200, type="consume_comment", source="test")
    db.commit()

    assert consumed == 200
    assert get_available_credits(db, user.id) == 300


# ─── task_analyze_connection ─────────────────────────────────────────

def _make_post_with_pending_comments(db, connection, n_comments: int, suffix: str = "") -> Post:
    post = Post(
        id=uuid.uuid4(),
        connection_id=connection.id,
        platform=connection.platform,
        platform_post_id=f"post-{suffix or uuid.uuid4().hex[:6]}",
        content_text="test post",
    )
    db.add(post)
    db.flush()
    for i in range(n_comments):
        db.add(
            Comment(
                id=uuid.uuid4(),
                post_id=post.id,
                connection_id=connection.id,
                platform=connection.platform,
                platform_comment_id=f"c-{post.platform_post_id}-{i}",
                author_username=f"user{i}",
                text_original=f"comment {i}",
                text_clean=f"comment {i}",
                status="pending",
            )
        )
    db.commit()
    return post


def _fake_analyze_all_pending(db_session):
    """Retorna um fake de analyze_post_comments que marca pendentes como processed."""

    def fake(db, post_id, batch_size=50, prompt_version="v1"):
        pending = (
            db.query(Comment)
            .filter(Comment.post_id == post_id, Comment.status == "pending")
            .all()
        )
        for c in pending:
            c.status = "processed"
        db.commit()
        return {"analyzed": len(pending), "llm_calls": 1, "errors": 0, "cost_usd": 0.0}

    return fake


@pytest.fixture
def eager_task_db(monkeypatch, db):
    """Aponta o SessionLocal das tasks Celery para o banco de teste."""
    from tests.conftest import TestSessionLocal

    monkeypatch.setattr("app.tasks.pipeline_tasks.SessionLocal", TestSessionLocal)
    return db


def test_analyze_task_debits_credits(eager_task_db, test_user, test_connection, monkeypatch):
    db = eager_task_db
    user, _ = test_user
    grant_pack(db, user.id, 50)
    db.commit()

    _make_post_with_pending_comments(db, test_connection, 3)

    import app.services.analysis_service as analysis_service

    monkeypatch.setattr(analysis_service, "analyze_post_comments", _fake_analyze_all_pending(db))
    monkeypatch.setattr(analysis_service, "generate_post_summary", lambda db, post_id: None)

    from app.tasks.pipeline_tasks import task_analyze_connection

    result = task_analyze_connection.apply(
        args=[str(test_connection.id), str(user.id)]
    ).get()
    db.expire_all()

    assert result.get("comments_analyzed") == 3
    assert get_available_credits(db, user.id) == 47

    txn = (
        db.query(CreditTransaction)
        .filter(
            CreditTransaction.user_id == user.id,
            CreditTransaction.type == "consume_comment",
        )
        .first()
    )
    assert txn is not None
    assert txn.amount == -3

    run = (
        db.query(PipelineRun)
        .filter(PipelineRun.connection_id == test_connection.id)
        .first()
    )
    assert run is not None
    assert run.status == "completed"


def test_analyze_task_stops_when_credits_depleted(eager_task_db, test_user, test_connection, monkeypatch):
    db = eager_task_db
    user, _ = test_user
    grant_pack(db, user.id, 2)  # só cobre o primeiro post
    db.commit()

    _make_post_with_pending_comments(db, test_connection, 2, suffix="a")
    _make_post_with_pending_comments(db, test_connection, 2, suffix="b")

    import app.services.analysis_service as analysis_service

    monkeypatch.setattr(analysis_service, "analyze_post_comments", _fake_analyze_all_pending(db))
    monkeypatch.setattr(analysis_service, "generate_post_summary", lambda db, post_id: None)

    from app.tasks.pipeline_tasks import task_analyze_connection

    task_analyze_connection.apply(args=[str(test_connection.id), str(user.id)]).get()
    db.expire_all()

    # Saldo zerado e nem todos os comentários analisados
    assert get_available_credits(db, user.id) == 0
    pending_left = (
        db.query(Comment)
        .filter(Comment.connection_id == test_connection.id, Comment.status == "pending")
        .count()
    )
    assert pending_left == 2  # o segundo post não foi analisado

    run = (
        db.query(PipelineRun)
        .filter(PipelineRun.connection_id == test_connection.id)
        .first()
    )
    assert run is not None
    assert run.status == "partial"
    assert "créditos esgotados" in (run.notes or "")


def test_analyze_task_free_user_analyzes_nothing(eager_task_db, test_user, test_connection, monkeypatch):
    """Usuário sem saldo (estado free) não recebe análise de graça."""
    db = eager_task_db
    user, _ = test_user
    get_or_create_balance(db, user.id)  # free = 0
    db.commit()

    _make_post_with_pending_comments(db, test_connection, 3)

    import app.services.analysis_service as analysis_service

    calls = {"n": 0}

    def counting_fake(db_, post_id, batch_size=50, prompt_version="v1"):
        calls["n"] += 1
        return {"analyzed": 0, "llm_calls": 0, "errors": 0}

    monkeypatch.setattr(analysis_service, "analyze_post_comments", counting_fake)
    monkeypatch.setattr(analysis_service, "generate_post_summary", lambda db, post_id: None)

    from app.tasks.pipeline_tasks import task_analyze_connection

    task_analyze_connection.apply(args=[str(test_connection.id), str(user.id)]).get()
    db.expire_all()

    assert calls["n"] == 0  # loop interrompido antes de qualquer análise
    pending_left = (
        db.query(Comment)
        .filter(Comment.connection_id == test_connection.id, Comment.status == "pending")
        .count()
    )
    assert pending_left == 3


# ─── task_daily_sync ─────────────────────────────────────────────────

def test_daily_sync_skips_user_without_credits(eager_task_db, db, test_user, monkeypatch):
    user, _ = test_user
    user.plan = "starter"  # plano com sync recorrente
    db.commit()

    # Saldo zerado explicitamente (sem passar por get_or_create, que concederia os créditos do plano)
    db.add(CreditBalance(user_id=user.id, plan_credits=0, pack_credits=0))
    db.commit()

    conn = SocialConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        platform="youtube",
        username="@NoCredits",
        status="active",
        auto_sync=True,
    )
    db.add(conn)
    db.commit()

    ingest_calls = {"n": 0}

    def fake_ingest(*args, **kwargs):
        ingest_calls["n"] += 1
        return {"posts_fetched": 0, "comments_fetched": 0}

    monkeypatch.setattr("app.tasks.pipeline_tasks._do_ingest", fake_ingest)

    from app.tasks.pipeline_tasks import task_daily_sync

    results = task_daily_sync.apply(kwargs={"frequency_filter": None}).get()
    db.expire_all()

    assert results.get("@NoCredits") == {"skipped": "no_credits"}
    assert ingest_calls["n"] == 0  # nenhum centavo de Apify gasto


# ─── trigger_analyze (router) ────────────────────────────────────────

def test_trigger_analyze_402_without_credits(client, auth_headers, test_connection, db):
    res = client.post(
        f"/api/v1/connections/{test_connection.id}/analyze",
        headers=auth_headers,
    )
    assert res.status_code == 402
    assert "crédito" in res.json()["detail"].lower()

    # Nenhuma run criada
    runs = db.query(PipelineRun).filter(PipelineRun.connection_id == test_connection.id).count()
    assert runs == 0


def test_trigger_analyze_with_credits_creates_run(client, auth_headers, test_connection, db):
    grant_pack(db, test_connection.user_id, 10)
    db.commit()

    with patch("app.tasks.pipeline_tasks.task_analyze_connection.delay") as delay:
        delay.return_value.id = "celery-task-id"
        res = client.post(
            f"/api/v1/connections/{test_connection.id}/analyze",
            headers=auth_headers,
        )
    assert res.status_code == 200
