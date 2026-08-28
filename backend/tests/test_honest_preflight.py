"""P3.0 — preflight honesto, custo LLM somado e demographics opt-in."""

import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.models.comment import Comment
from app.models.post import Post
from app.services import analysis_service
from app.services.credit_service import grant_pack


def _post_with_pending(db, connection, n: int) -> Post:
    post = Post(
        id=uuid.uuid4(),
        connection_id=connection.id,
        platform="youtube",
        platform_post_id=f"hp-{uuid.uuid4().hex[:8]}",
        content_text="post",
        comment_count=n,
        published_at=datetime.now(timezone.utc),
    )
    db.add(post)
    db.flush()
    for i in range(n):
        db.add(
            Comment(
                id=uuid.uuid4(),
                post_id=post.id,
                connection_id=connection.id,
                platform="youtube",
                platform_comment_id=f"hpc-{post.platform_post_id}-{i}",
                text_original=f"c{i}",
                text_clean=f"c{i}",
                status="pending",
            )
        )
    db.commit()
    return post


def test_preflight_sync_includes_backlog_in_credits(client, auth_headers, test_connection, db):
    """A run manual também processa o backlog — a estimativa precisa incluí-lo."""
    _post_with_pending(db, test_connection, 40)
    grant_pack(db, test_connection.user_id, 1000)
    db.commit()

    res = client.post(
        f"/api/v1/connections/{test_connection.id}/preflight?mode=sync",
        headers=auth_headers,
        json={"max_posts": 5, "max_comments_per_post": 200},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["pending_backlog"] == 40
    # créditos = novos estimados + backlog
    assert data["estimated_credits"] == data["estimated_comments"] + 40
    assert "demographics_available" in data
    assert data["demographics_cost_per_profile"] == 5
    assert "last_sync_at" in data


def test_analyze_post_comments_sums_llm_cost(db, test_connection, monkeypatch):
    """cost_usd deixou de ser sempre 0: soma o cost_estimate_usd de cada análise."""
    test_connection.ignore_author_comments = False
    db.commit()
    post = _post_with_pending(db, test_connection, 2)

    class DummyLLM:
        def analyze_comments(self, comments_payload, prompt_version, context=None):
            for item in comments_payload:
                yield {
                    "comment_id": item["comment_id"],
                    "model": settings.LLM_MODEL,
                    "prompt_version": "v1",
                    "score_0_10": 7.0,
                    "polarity": 0.5,
                    "intensity": 0.5,
                    "emotions": ["alegria"],
                    "topics": [],
                    "sarcasm": False,
                    "summary_pt": "ok",
                    "confidence": 0.9,
                    "cost_estimate_usd": 0.0015,
                }

    monkeypatch.setattr(analysis_service, "LLMClient", DummyLLM)

    stats = analysis_service.analyze_post_comments(db, post.id, batch_size=10)

    assert stats["analyzed"] == 2
    assert abs(stats["cost_usd"] - 0.003) < 1e-9


def test_full_pipeline_skips_demographics_by_default(db, test_user, test_connection, monkeypatch):
    """Demographics é opt-in: sem include_demographics, não roda (nem gasta Apify)."""
    from tests.conftest import TestSessionLocal

    monkeypatch.setattr("app.tasks.pipeline_tasks.SessionLocal", TestSessionLocal)

    user, _ = test_user
    grant_pack(db, user.id, 100)
    db.commit()

    monkeypatch.setattr(
        "app.tasks.pipeline_tasks._do_ingest",
        lambda db_, conn, **kw: {"posts_fetched": 0, "comments_fetched": 0},
    )

    demo_calls = {"n": 0}

    def fake_demo(*args, **kwargs):
        demo_calls["n"] += 1
        return {"skipped": False, "profiles_enriched": 1}

    monkeypatch.setattr(
        "app.services.demographics_service.run_demographics_pipeline", fake_demo
    )

    from app.tasks.pipeline_tasks import task_full_pipeline

    # default: sem demographics
    task_full_pipeline.apply(args=[str(test_connection.id), str(user.id)]).get()
    assert demo_calls["n"] == 0

    # opt-in: roda
    task_full_pipeline.apply(
        args=[str(test_connection.id), str(user.id)],
        kwargs={"include_demographics": True},
    ).get()
    assert demo_calls["n"] == 1


def test_full_pipeline_final_stage_is_done(db, test_user, test_connection, monkeypatch):
    from tests.conftest import TestSessionLocal

    monkeypatch.setattr("app.tasks.pipeline_tasks.SessionLocal", TestSessionLocal)

    user, _ = test_user
    grant_pack(db, user.id, 100)
    db.commit()

    _post_with_pending(db, test_connection, 1)

    class DummyLLM:
        def analyze_comments(self, comments_payload, prompt_version, context=None):
            for item in comments_payload:
                yield {
                    "comment_id": item["comment_id"],
                    "model": settings.LLM_MODEL,
                    "prompt_version": "v1",
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

    test_connection.ignore_author_comments = False
    db.commit()
    monkeypatch.setattr(analysis_service, "LLMClient", DummyLLM)
    monkeypatch.setattr(
        "app.tasks.pipeline_tasks._do_ingest",
        lambda db_, conn, **kw: {"posts_fetched": 1, "comments_fetched": 1},
    )

    from app.tasks.pipeline_tasks import task_full_pipeline

    task_full_pipeline.apply(args=[str(test_connection.id), str(user.id)]).get()
    db.expire_all()

    from app.models.pipeline_run import PipelineRun

    run = (
        db.query(PipelineRun)
        .filter(PipelineRun.connection_id == test_connection.id)
        .order_by(PipelineRun.started_at.desc())
        .first()
    )
    assert run is not None
    assert run.status in ("completed", "partial")
    assert run.stage == "done"
    assert run.total_cost_usd > 0
