"""P2 — testes dos tetos de segurança do Apify (aprendizado da run de US$40)."""

import uuid

from app.models.social_connection import SocialConnection
from app.services.credit_service import grant_pack
from app.services import apify_service


def test_fetch_comments_apify_clamps_max_items(monkeypatch):
    """Nenhum request ao actor de comentários sai com maxItems acima do teto duro."""
    captured: list[int] = []

    def fake_fetch(post_url, max_items, token):
        captured.append(max_items)
        return []

    monkeypatch.setattr(apify_service, "_fetch_comments_for_post", fake_fetch)
    monkeypatch.setattr(apify_service, "is_limit_reached", lambda: False)
    monkeypatch.setattr(apify_service, "_get_token", lambda: "test-token")

    apify_service.fetch_comments_apify(
        ["https://www.instagram.com/p/XYZ/"],
        max_per_post=999_999,  # o valor que causou a run de US$40
    )

    assert captured == [apify_service.HARD_MAX_COMMENTS_PER_POST]


def test_fetch_comments_apify_respects_lower_limits(monkeypatch):
    captured: list[int] = []

    def fake_fetch(post_url, max_items, token):
        captured.append(max_items)
        return []

    monkeypatch.setattr(apify_service, "_fetch_comments_for_post", fake_fetch)
    monkeypatch.setattr(apify_service, "is_limit_reached", lambda: False)
    monkeypatch.setattr(apify_service, "_get_token", lambda: "test-token")

    apify_service.fetch_comments_apify(
        ["https://www.instagram.com/p/ABC/"],
        max_per_post=200,
    )

    assert captured == [200]


def test_daily_sync_caps_comments_per_post(db, test_user, monkeypatch):
    """O sync automático nunca usa o limite cheio do plano como maxItems."""
    from tests.conftest import TestSessionLocal

    monkeypatch.setattr("app.tasks.pipeline_tasks.SessionLocal", TestSessionLocal)

    user, _ = test_user
    user.plan = "admin"  # plano com max_comments_per_post = 999999
    db.commit()
    grant_pack(db, user.id, 1000)
    db.commit()

    conn = SocialConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        platform="youtube",
        username="@CapTest",
        status="active",
        auto_sync=True,
    )
    db.add(conn)
    db.commit()

    captured_kwargs: dict = {}

    def fake_ingest(db_, connection, **kwargs):
        captured_kwargs.update(kwargs)
        return {"posts_fetched": 0, "comments_fetched": 0}

    monkeypatch.setattr("app.tasks.pipeline_tasks._do_ingest", fake_ingest)

    from app.tasks.pipeline_tasks import task_daily_sync, DAILY_SYNC_MAX_COMMENTS_PER_POST

    task_daily_sync.apply(kwargs={"frequency_filter": None}).get()

    assert captured_kwargs.get("max_comments_per_post") == DAILY_SYNC_MAX_COMMENTS_PER_POST
    assert captured_kwargs.get("max_comments_per_post") <= 500
