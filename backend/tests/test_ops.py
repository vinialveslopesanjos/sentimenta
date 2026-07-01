import uuid

from app.core.security import create_access_token, hash_password
from app.models.user import User


def _admin_headers(db):
    user = User(
        id=uuid.uuid4(),
        email="ops-admin@example.com",
        password_hash=hash_password("AdminPass123"),
        name="Ops Admin",
        plan="admin",
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "token_version": user.token_version})
    return {"Authorization": f"Bearer {token}"}


def test_ops_health_requires_admin(client, auth_headers):
    res = client.get("/api/v1/ops/health", headers=auth_headers)
    assert res.status_code == 403
    assert res.json()["detail"] == "admin_required"


def test_ops_health_returns_async_sli_snapshot(client, db, monkeypatch):
    monkeypatch.setattr(
        "app.routers.ops._celery_status",
        lambda: {"ok": True, "workers": 1, "worker_names": ["worker@test"], "queue_depth": 0},
    )
    monkeypatch.setattr(
        "app.routers.ops._redis_status",
        lambda url: {"ok": True, "used_memory_bytes": 123, "connected_clients": 1},
    )

    res = client.get("/api/v1/ops/health", headers=_admin_headers(db))

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["database"]["ok"] is True
    assert data["celery"]["workers"] == 1
    assert data["celery"]["queue_depth"] == 0
    assert data["pipeline"]["stale_running"] == 0
