"""P3.1 — pipeline de análise rápido.

Cobre as causas da run de 2h53min medida em produção (07/07/2026):
1. task_full_pipeline / task_analyze_connection iteravam TODOS os posts da
   conexão (307!) em vez de só os com comentários pendentes.
2. Visual context (Vision LLM) não pode ser regerado quando já existe cache
   em post.image_context, nem gerado para post sem comentários pendentes.
3. Notes legíveis: posts com 0 processados não geram step; resumo único no fim.
"""

import json
import uuid
from datetime import datetime, timezone

import pytest

from app.core.config import settings
from app.models.comment import Comment
from app.models.pipeline_run import PipelineRun
from app.models.post import Post
from app.services import analysis_service
from app.services.credit_service import grant_pack


def _make_post(db, connection, n_pending: int = 0, n_processed: int = 0, **post_kwargs) -> Post:
    post = Post(
        id=uuid.uuid4(),
        connection_id=connection.id,
        platform=connection.platform,
        platform_post_id=f"fa-{uuid.uuid4().hex[:8]}",
        content_text="post",
        published_at=datetime.now(timezone.utc),
        **post_kwargs,
    )
    db.add(post)
    db.flush()
    for i, status in enumerate(["pending"] * n_pending + ["processed"] * n_processed):
        db.add(
            Comment(
                id=uuid.uuid4(),
                post_id=post.id,
                connection_id=connection.id,
                platform=connection.platform,
                platform_comment_id=f"fac-{post.platform_post_id}-{i}",
                text_original=f"c{i}",
                text_clean=f"c{i}",
                status=status,
            )
        )
    db.commit()
    return post


def _counting_analyze_fake(analyzed_post_ids):
    """Fake de analyze_post_comments: registra post_id e processa os pendentes."""

    def fake(db, post_id, batch_size=50, prompt_version="v1"):
        analyzed_post_ids.append(post_id)
        pending = (
            db.query(Comment)
            .filter(Comment.post_id == post_id, Comment.status == "pending")
            .all()
        )
        for c in pending:
            c.status = "processed"
        db.commit()
        return {"analyzed": len(pending), "llm_calls": 1, "errors": 0, "cost_usd": 0.001}

    return fake


@pytest.fixture
def eager_task_db(monkeypatch, db):
    from tests.conftest import TestSessionLocal

    monkeypatch.setattr("app.tasks.pipeline_tasks.SessionLocal", TestSessionLocal)
    return db


def _run_steps(run: PipelineRun) -> list[str]:
    notes = json.loads(run.notes or "{}")
    return [s["msg"] for s in notes.get("steps", [])]


# ─── 1. Só posts com pendências entram no loop de análise ────────────


def test_full_pipeline_analyzes_only_posts_with_pending(eager_task_db, test_user, test_connection, monkeypatch):
    db = eager_task_db
    user, _ = test_user
    grant_pack(db, user.id, 100)
    db.commit()

    post_pending = _make_post(db, test_connection, n_pending=2)
    _make_post(db, test_connection, n_processed=3)  # backlog já analisado
    _make_post(db, test_connection)  # sem comentários

    analyzed_post_ids: list = []
    monkeypatch.setattr(analysis_service, "analyze_post_comments", _counting_analyze_fake(analyzed_post_ids))
    monkeypatch.setattr(analysis_service, "generate_post_summary", lambda db_, post_id: None)
    monkeypatch.setattr(
        "app.tasks.pipeline_tasks._do_ingest",
        lambda db_, conn, **kw: {"posts_fetched": 1, "comments_fetched": 2},
    )

    from app.tasks.pipeline_tasks import task_full_pipeline

    result = task_full_pipeline.apply(args=[str(test_connection.id), str(user.id)]).get()
    db.expire_all()

    # analyze só foi chamado para o post com pendências
    assert analyzed_post_ids == [post_pending.id]
    assert result.get("comments_analyzed") == 2

    run = db.query(PipelineRun).filter(PipelineRun.connection_id == test_connection.id).first()
    assert run is not None
    steps = _run_steps(run)
    # Nenhum step de post com 0 processados
    assert not any(": 0 comentários" in s for s in steps)
    # Resumo único dos posts pulados
    assert any("2 posts sem comentários pendentes pulados" in s for s in steps)


def test_analyze_connection_analyzes_only_posts_with_pending(eager_task_db, test_user, test_connection, monkeypatch):
    db = eager_task_db
    user, _ = test_user
    grant_pack(db, user.id, 100)
    db.commit()

    post_pending = _make_post(db, test_connection, n_pending=3)
    _make_post(db, test_connection, n_processed=2)
    _make_post(db, test_connection)

    analyzed_post_ids: list = []
    monkeypatch.setattr(analysis_service, "analyze_post_comments", _counting_analyze_fake(analyzed_post_ids))
    monkeypatch.setattr(analysis_service, "generate_post_summary", lambda db_, post_id: None)

    from app.tasks.pipeline_tasks import task_analyze_connection

    result = task_analyze_connection.apply(args=[str(test_connection.id), str(user.id)]).get()
    db.expire_all()

    assert analyzed_post_ids == [post_pending.id]
    assert result.get("comments_analyzed") == 3
    assert result.get("posts_fetched") == 3  # contador da run continua sendo o total

    run = db.query(PipelineRun).filter(PipelineRun.connection_id == test_connection.id).first()
    assert run is not None
    assert run.status == "completed"
    steps = _run_steps(run)
    assert not any(": 0 comentários" in s for s in steps)
    assert any("2 posts sem comentários pendentes pulados" in s for s in steps)


def test_parallel_waves_analyze_all_pending_posts(eager_task_db, test_user, test_connection, monkeypatch):
    """Vários posts pendentes com saldo folgado: todos analisados via waves."""
    db = eager_task_db
    user, _ = test_user
    grant_pack(db, user.id, 1000)
    db.commit()

    posts = [_make_post(db, test_connection, n_pending=2) for _ in range(5)]

    analyzed_post_ids: list = []

    def thread_safe_fake(db_, post_id, batch_size=50, prompt_version="v1"):
        # Não toca no banco: threads em SQLite compartilham a mesma conexão
        analyzed_post_ids.append(post_id)
        return {"analyzed": 2, "llm_calls": 1, "errors": 0, "cost_usd": 0.001}

    monkeypatch.setattr(analysis_service, "analyze_post_comments", thread_safe_fake)
    monkeypatch.setattr(analysis_service, "generate_post_summary", lambda db_, post_id: None)

    from app.tasks.pipeline_tasks import task_analyze_connection

    result = task_analyze_connection.apply(args=[str(test_connection.id), str(user.id)]).get()
    db.expire_all()

    assert sorted(str(p) for p in analyzed_post_ids) == sorted(str(p.id) for p in posts)
    assert result.get("comments_analyzed") == 10


# ─── 2. Visual context: cache e guarda de pendências ─────────────────


class _VisionSpyLLM:
    """LLM fake que conta chamadas de Vision e responde análises válidas."""

    vision_calls = 0

    def analyze_image(self, image_url, caption=None):
        _VisionSpyLLM.vision_calls += 1
        return "uma foto de paisagem com montanhas"

    def analyze_comments(self, comments_payload, prompt_version, context=None):
        for item in comments_payload:
            yield {
                "comment_id": item["comment_id"],
                "model": settings.LLM_MODEL,
                "prompt_version": prompt_version,
                "score_0_10": 7.0,
                "polarity": 0.5,
                "intensity": 0.5,
                "emotions": [],
                "topics": [],
                "sarcasm": False,
                "summary_pt": "ok",
                "confidence": 0.9,
                "cost_estimate_usd": 0.001,
            }


@pytest.fixture
def vision_spy(monkeypatch):
    _VisionSpyLLM.vision_calls = 0
    monkeypatch.setattr(analysis_service, "LLMClient", _VisionSpyLLM)
    return _VisionSpyLLM


def test_visual_context_not_regenerated_when_cached(db, test_connection, vision_spy):
    test_connection.ignore_author_comments = False
    db.commit()
    post = _make_post(
        db, test_connection, n_pending=1,
        media_urls={"url": "https://example.com/img.jpg"},
        image_context="contexto já gerado anteriormente",
    )

    stats = analysis_service.analyze_post_comments(db, post.id)

    assert stats["analyzed"] == 1
    assert vision_spy.vision_calls == 0  # cache respeitado — Vision não roda de novo
    db.refresh(post)
    assert post.image_context == "contexto já gerado anteriormente"


def test_visual_context_generated_once_when_missing(db, test_connection, vision_spy):
    test_connection.ignore_author_comments = False
    db.commit()
    post = _make_post(
        db, test_connection, n_pending=1,
        media_urls={"url": "https://example.com/img.jpg"},
    )

    analysis_service.analyze_post_comments(db, post.id)

    assert vision_spy.vision_calls == 1
    db.refresh(post)
    assert post.image_context == "uma foto de paisagem com montanhas"


def test_visual_context_not_generated_without_pending_comments(db, test_connection, vision_spy):
    test_connection.ignore_author_comments = False
    db.commit()
    post = _make_post(
        db, test_connection, n_processed=2,
        media_urls={"url": "https://example.com/img.jpg"},
    )

    stats = analysis_service.analyze_post_comments(db, post.id)

    assert stats["analyzed"] == 0
    assert vision_spy.vision_calls == 0  # sem pendências, Vision não roda
    db.refresh(post)
    assert post.image_context is None
