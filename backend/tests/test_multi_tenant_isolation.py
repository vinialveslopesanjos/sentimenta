"""Cross-tenant authorization regression tests."""

import uuid
from datetime import datetime, timezone

from app.core.security import create_access_token, hash_password
from app.models.comment import Comment
from app.models.credits import CreditBalance, CreditTransaction
from app.models.pipeline_run import PipelineRun
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.models.user import User


def _create_user(db, email: str, plan: str = "free") -> tuple[User, dict[str, str]]:
    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password("TenantPass123"),
        name=email.split("@")[0],
        plan=plan,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "token_version": user.token_version})
    return user, {"Authorization": f"Bearer {token}"}


def _create_connection(db, user: User, username: str) -> SocialConnection:
    conn = SocialConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        platform="youtube",
        username=username,
        display_name=username,
        status="active",
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


def _create_post_with_comment(db, conn: SocialConnection, suffix: str) -> tuple[Post, Comment]:
    post = Post(
        id=uuid.uuid4(),
        connection_id=conn.id,
        platform="youtube",
        platform_post_id=f"video_{suffix}",
        post_type="video",
        content_text=f"Video {suffix}",
        content_clean=f"video {suffix}",
        published_at=datetime.now(timezone.utc),
    )
    db.add(post)
    db.flush()
    comment = Comment(
        id=uuid.uuid4(),
        post_id=post.id,
        connection_id=conn.id,
        platform="youtube",
        platform_comment_id=f"comment_{suffix}",
        source_type="comment",
        author_name=f"Author {suffix}",
        author_username=f"author_{suffix}",
        text_original=f"Tenant comment {suffix}",
        text_clean=f"tenant comment {suffix}",
        text_hash=f"hash_{suffix}",
        status="pending",
    )
    db.add(comment)
    db.commit()
    db.refresh(post)
    db.refresh(comment)
    return post, comment


def test_authenticated_resources_do_not_cross_tenant_boundaries(client, db, test_user, test_connection, test_post, test_comments):
    owner_user, owner_token = test_user
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    other_user, _ = _create_user(db, "other-tenant@example.com", plan="business")
    other_conn = _create_connection(db, other_user, "@OtherTenant")
    other_post, _ = _create_post_with_comment(db, other_conn, "other")
    other_run = PipelineRun(
        id=uuid.uuid4(),
        user_id=other_user.id,
        connection_id=other_conn.id,
        run_type="sync",
        status="running",
        celery_task_id="other-tenant-task",
    )
    db.add(other_run)
    other_balance = CreditBalance(user_id=other_user.id, plan_credits=999, pack_credits=0)
    db.add(other_balance)
    db.flush()
    db.add(
        CreditTransaction(
            user_id=other_user.id,
            balance_id=other_balance.id,
            amount=-10,
            type="usage",
            source="sync",
            balance_after=989,
            description="other tenant transaction",
        )
    )
    db.commit()

    assert client.get(f"/api/v1/connections/{other_conn.id}", headers=owner_headers).status_code == 404
    assert client.get(f"/api/v1/posts/{other_post.id}", headers=owner_headers).status_code == 404

    own_post_list = client.get("/api/v1/posts", headers=owner_headers)
    assert own_post_list.status_code == 200
    assert [post["id"] for post in own_post_list.json()] == [str(test_post.id)]

    other_connection_posts = client.get(
        f"/api/v1/posts?connection_id={other_conn.id}",
        headers=owner_headers,
    )
    assert other_connection_posts.status_code == 200
    assert other_connection_posts.json() == []

    other_comments = client.get(
        f"/api/v1/comments?connection_id={other_conn.id}",
        headers=owner_headers,
    )
    assert other_comments.status_code == 200
    assert other_comments.json()["total"] == 0

    other_post_comments = client.get(
        f"/api/v1/comments?post_id={other_post.id}",
        headers=owner_headers,
    )
    assert other_post_comments.status_code == 200
    assert other_post_comments.json()["total"] == 0

    dashboard = client.get("/api/v1/dashboard/summary", headers=owner_headers)
    assert dashboard.status_code == 200
    assert dashboard.json()["total_posts"] == 1
    assert dashboard.json()["total_comments"] == len(test_comments)

    run_detail = client.get(f"/api/v1/pipeline/runs/{other_run.id}", headers=owner_headers)
    assert run_detail.status_code == 404
    run_status = client.get(f"/api/v1/pipeline/runs/{other_run.id}/status", headers=owner_headers)
    assert run_status.status_code == 404
    run_list = client.get("/api/v1/pipeline/runs", headers=owner_headers)
    assert run_list.status_code == 200
    assert str(other_run.id) not in {run["id"] for run in run_list.json()}

    usage = client.get("/api/v1/billing/usage", headers=owner_headers)
    assert usage.status_code == 200
    assert usage.json()["plan"] == owner_user.plan

    credit_history = client.get("/api/v1/billing/credits/history", headers=owner_headers)
    assert credit_history.status_code == 200
    assert all(item["description"] != "other tenant transaction" for item in credit_history.json())
