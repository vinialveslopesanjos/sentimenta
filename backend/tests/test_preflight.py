"""P1 — testes do endpoint de preflight (estimativa sem side effects)."""

import uuid

from app.models.comment import Comment
from app.models.pipeline_run import PipelineRun
from app.models.post import Post
from app.services.credit_service import grant_pack


def _add_post_with_comments(db, connection, n_pending: int, comment_count: int = 0):
    post = Post(
        id=uuid.uuid4(),
        connection_id=connection.id,
        platform="youtube",
        platform_post_id=f"pf-{uuid.uuid4().hex[:8]}",
        content_text="post",
        comment_count=comment_count,
    )
    db.add(post)
    db.flush()
    for i in range(n_pending):
        db.add(
            Comment(
                id=uuid.uuid4(),
                post_id=post.id,
                connection_id=connection.id,
                platform="youtube",
                platform_comment_id=f"pfc-{post.platform_post_id}-{i}",
                text_original=f"c{i}",
                text_clean=f"c{i}",
                status="pending",
            )
        )
    db.commit()
    return post


def test_preflight_analyze_counts_pending(client, auth_headers, test_connection, db):
    _add_post_with_comments(db, test_connection, 7)
    grant_pack(db, test_connection.user_id, 100)
    db.commit()

    res = client.post(
        f"/api/v1/connections/{test_connection.id}/preflight?mode=analyze",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "analyze"
    assert data["estimated_credits"] == 7
    assert data["pending_comments"] == 7
    assert data["available_credits"] == 100
    assert data["fits"] is True
    assert data["missing_credits"] == 0

    # Sem side effects: nenhuma run criada
    assert db.query(PipelineRun).count() == 0


def test_preflight_analyze_no_credits_does_not_fit(client, auth_headers, test_connection, db):
    _add_post_with_comments(db, test_connection, 5)

    res = client.post(
        f"/api/v1/connections/{test_connection.id}/preflight?mode=analyze",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["available_credits"] == 0
    assert data["fits"] is False
    assert data["missing_credits"] == 5


def test_preflight_sync_caps_to_plan(client, auth_headers, test_connection, db):
    # free: max_posts_per_sync = 5; sem histórico → fallback 50 comentários/post
    res = client.post(
        f"/api/v1/connections/{test_connection.id}/preflight?mode=sync",
        headers=auth_headers,
        json={"max_posts": 50, "max_comments_per_post": 200},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "sync"
    assert data["estimated_posts"] == 5  # capado pelo plano free
    assert data["avg_comments_per_post"] == 50
    assert data["estimated_comments"] == 5 * 50
    assert data["estimated_credits"] == data["estimated_comments"]


def test_preflight_sync_uses_historical_average(client, auth_headers, test_connection, db):
    _add_post_with_comments(db, test_connection, 0, comment_count=20)
    _add_post_with_comments(db, test_connection, 0, comment_count=40)

    res = client.post(
        f"/api/v1/connections/{test_connection.id}/preflight?mode=sync",
        headers=auth_headers,
        json={"max_posts": 5, "max_comments_per_post": 200},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["avg_comments_per_post"] == 30
    assert data["estimated_comments"] == 5 * 30


def test_preflight_invalid_mode(client, auth_headers, test_connection):
    res = client.post(
        f"/api/v1/connections/{test_connection.id}/preflight?mode=banana",
        headers=auth_headers,
    )
    assert res.status_code == 422
