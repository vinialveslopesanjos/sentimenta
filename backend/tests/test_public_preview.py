"""Prévia Mágica — endpoint público anônimo."""

import uuid
from datetime import datetime, timezone

from app.models.analysis import CommentAnalysis
from app.models.comment import Comment
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.models.user import User
from app.services import preview_service


def _seed_analyzed_preview(db, handle="@canal"):
    """Cria conexão de preview com 1 post analisado (simula run_preview já feito)."""
    user = preview_service._get_preview_user(db)
    conn = SocialConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        platform="youtube",
        username=handle,
        display_name="Canal Teste",
        followers_count=1000,
        status="active",
        auto_sync=False,
    )
    db.add(conn)
    db.flush()
    post = Post(
        id=uuid.uuid4(),
        connection_id=conn.id,
        platform="youtube",
        platform_post_id="vid1",
        content_text="Meu vídeo novo",
        published_at=datetime.now(timezone.utc),
    )
    db.add(post)
    db.flush()
    for i, score in enumerate([9.0, 8.0, 2.0]):
        c = Comment(
            id=uuid.uuid4(),
            post_id=post.id,
            connection_id=conn.id,
            platform="youtube",
            platform_comment_id=f"c{i}",
            text_original=f"comentario {i}",
            text_clean=f"comentario {i}",
            status="processed",
        )
        db.add(c)
        db.flush()
        db.add(CommentAnalysis(
            comment_id=c.id,
            model="test",
            prompt_version="v1",
            score_0_10=score,
            emotions=["alegria"] if score > 6 else ["raiva"],
        ))
    db.commit()
    return conn


def test_preview_system_user_is_admin_and_verified(db):
    user = preview_service._get_preview_user(db)
    assert user.plan == "admin"
    assert user.email_verified is True
    # idempotente
    again = preview_service._get_preview_user(db)
    assert again.id == user.id


def test_build_response_aggregates_scores_and_emotions(db):
    conn = _seed_analyzed_preview(db)
    resp = preview_service._build_response(db, conn)
    assert resp["platform"] == "youtube"
    assert resp["handle"] == "@canal"
    assert resp["profile"]["followers_count"] == 1000
    assert len(resp["posts"]) == 1
    post = resp["posts"][0]
    assert post["analyzed_comments"] == 3
    assert post["avg_score"] == round((9.0 + 8.0 + 2.0) / 3, 1)
    assert post["sentiment_split"] == {"positive": 2, "neutral": 0, "negative": 1}
    assert post["top_emotion"] == "alegria"
    assert resp["overall_score"] is not None


def test_preview_endpoint_uses_cache(client, db, monkeypatch):
    payload = {"platform": "youtube", "handle": "@viral", "posts": [{"avg_score": 8.0}], "overall_score": 8.0}
    monkeypatch.setattr(preview_service, "get_cached_preview", lambda p, h: dict(payload))

    # Cache hit não deve chamar run_preview nem rate-limit
    called = {"run": 0}
    monkeypatch.setattr(preview_service, "run_preview", lambda *a, **k: called.__setitem__("run", called["run"] + 1))

    res = client.post("/api/v1/public/preview", json={"platform": "youtube", "handle": "@viral"})
    assert res.status_code == 200
    assert res.json()["cached"] is True
    assert called["run"] == 0


def test_preview_endpoint_runs_and_returns(client, db, monkeypatch):
    monkeypatch.setattr(preview_service, "get_cached_preview", lambda p, h: None)
    fake = {"platform": "youtube", "handle": "@novo", "posts": [{"avg_score": 7.0}], "overall_score": 7.0, "cached": False}
    monkeypatch.setattr(preview_service, "run_preview", lambda db_, p, h: fake)

    res = client.post("/api/v1/public/preview", json={"platform": "youtube", "handle": "@novo"})
    assert res.status_code == 200
    assert res.json()["overall_score"] == 7.0


def test_preview_endpoint_business_error_is_422(client, db, monkeypatch):
    from app.services.preview_service import PreviewError

    monkeypatch.setattr(preview_service, "get_cached_preview", lambda p, h: None)

    def boom(db_, p, h):
        raise PreviewError("private", "Perfil privado.")

    monkeypatch.setattr(preview_service, "run_preview", boom)
    res = client.post("/api/v1/public/preview", json={"platform": "instagram", "handle": "@privado"})
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "private"


def test_preview_endpoint_rejects_bad_platform(client):
    res = client.post("/api/v1/public/preview", json={"platform": "facebook", "handle": "@x"})
    assert res.status_code == 422  # pydantic pattern
