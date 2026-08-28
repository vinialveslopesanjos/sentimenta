import uuid
from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token, hash_password
from app.models.data_snapshot import DataSnapshot
from app.models.operational_event import OperationalEvent
from app.models.pipeline_run import PipelineRun
from app.models.social_connection import SocialConnection
from app.models.support_ticket import SupportTicket
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

    trust = client.get("/api/v1/ops/trust", headers=auth_headers)
    assert trust.status_code == 403
    assert trust.json()["detail"] == "admin_required"


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


def test_ops_trust_returns_all_minimum_metrics_and_internal_alerts(client, db):
    now = datetime.now(timezone.utc)
    headers = _admin_headers(db)
    admin = db.query(User).filter(User.email == "ops-admin@example.com").one()

    youtube = SocialConnection(
        id=uuid.uuid4(),
        user_id=admin.id,
        platform="youtube",
        username="ops-youtube",
        status="active",
    )
    instagram = SocialConnection(
        id=uuid.uuid4(),
        user_id=admin.id,
        platform="instagram",
        username="ops-instagram",
        status="active",
    )
    db.add_all([youtube, instagram])
    db.flush()

    runs = [
        PipelineRun(
            id=uuid.uuid4(), user_id=admin.id, connection_id=youtube.id, run_type="full",
            status="completed", comments_fetched=10, comments_analyzed=10,
            started_at=now - timedelta(hours=3), ended_at=now - timedelta(hours=3) + timedelta(seconds=100),
        ),
        PipelineRun(
            id=uuid.uuid4(), user_id=admin.id, connection_id=youtube.id, run_type="full",
            status="partial", comments_fetched=10, comments_analyzed=5,
            started_at=now - timedelta(hours=2), ended_at=now - timedelta(hours=2) + timedelta(seconds=200),
        ),
        PipelineRun(
            id=uuid.uuid4(), user_id=admin.id, connection_id=youtube.id, run_type="full",
            status="failed", comments_fetched=10, comments_analyzed=0,
            started_at=now - timedelta(hours=1), ended_at=now - timedelta(hours=1) + timedelta(seconds=300),
        ),
        PipelineRun(
            id=uuid.uuid4(), user_id=admin.id, connection_id=youtube.id, run_type="full",
            status="running", comments_fetched=0, comments_analyzed=0,
            started_at=now - timedelta(hours=4), ended_at=None,
        ),
    ]
    db.add_all(runs)

    db.add_all(
        [
            DataSnapshot(
                id=uuid.uuid4(), user_id=admin.id, schema_version=1,
                period_start=now - timedelta(hours=6), period_end=now - timedelta(hours=1),
                last_attempt_at=now - timedelta(hours=1), last_success_at=now - timedelta(hours=1),
                source_platforms=["youtube"], profiles=[], found_count=10, eligible_count=10,
                collected_count=10, saved_count=10, analyzed_count=10, valid_count=10,
                ignored_count=0, coverage={}, health="healthy", reason_code="healthy",
                metrics={}, content_hash="a" * 64, created_at=now - timedelta(minutes=30),
            ),
            DataSnapshot(
                id=uuid.uuid4(), user_id=admin.id, schema_version=1,
                period_start=now - timedelta(hours=5), period_end=now - timedelta(hours=2),
                last_attempt_at=now - timedelta(hours=2), last_success_at=now - timedelta(hours=2),
                source_platforms=["youtube"], profiles=[], found_count=5, eligible_count=5,
                collected_count=5, saved_count=6, analyzed_count=5, valid_count=5,
                ignored_count=0, coverage={}, health="healthy", reason_code="legacy_divergence",
                metrics={}, content_hash="b" * 64, created_at=now - timedelta(minutes=20),
            ),
            OperationalEvent(
                event_type="drilldown_404", route_template="/api/v1/posts/{post_id}",
                status_code=404, event_metadata={"method": "GET"}, created_at=now - timedelta(minutes=10),
            ),
            SupportTicket(
                name="QA", email="trust@example.com", category="data_trust",
                subject="Score sem origem", message="Preciso entender a base.", created_at=now - timedelta(minutes=9),
            ),
            SupportTicket(
                name="QA", email="sync@example.com", category="collection_sync",
                subject="Coleta atrasada", message="A coleta não concluiu.", created_at=now - timedelta(minutes=8),
            ),
            SupportTicket(
                name="QA", email="coverage@example.com", category="data_trust",
                subject="Cobertura", message="A janela do alerta não ficou clara.", created_at=now - timedelta(minutes=8),
            ),
            SupportTicket(
                name="QA", email="billing@example.com", category="billing",
                subject="Pagamento", message="Dúvida de cobrança.", created_at=now - timedelta(minutes=7),
            ),
        ]
    )
    db.commit()

    res = client.get("/api/v1/ops/trust?hours=24", headers=headers)

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "critical"
    assert set(data["instrumentation"].values()) == {
        "instrumented",
        "instrumented_from_immutable_snapshots",
    }
    pipeline = data["metrics"]["pipeline"]
    assert pipeline["terminal_runs"] == 3
    assert pipeline["operational_success_rate"] == 0.3333
    assert pipeline["partial_rate"] == 0.3333
    assert pipeline["zero_valid_analyses"] == 1
    assert pipeline["stuck_runs"] == 1
    assert pipeline["duration_seconds"] == {"sample_count": 3, "p50": 200.0, "p95": 290.0}

    by_platform = {item["platform"]: item for item in data["metrics"]["platforms"]}
    assert by_platform["youtube"]["terminal_runs"] == 3
    assert by_platform["youtube"]["valid_data_age_seconds"] is not None
    assert by_platform["instagram"]["terminal_runs"] == 0
    assert data["metrics"]["count_reconciliation"]["divergences"] == 1
    assert data["metrics"]["drilldown_404"]["count"] == 1
    assert data["metrics"]["support_tickets"]["total"] == 4
    assert data["metrics"]["support_tickets"]["trust_related"] == 3

    alert_codes = {alert["code"] for alert in data["alerts"]}
    assert {
        "pipeline_stuck",
        "count_divergence",
        "zero_valid_analyses",
        "drilldown_404",
        "partial_rate_high",
        "trust_tickets_high",
        "platform_success_rate_low:youtube",
        "platform_no_recent_runs:instagram",
        "valid_data_stale:instagram",
    }.issubset(alert_codes)
    alerts_by_code = {alert["code"]: alert for alert in data["alerts"]}
    assert alerts_by_code["zero_valid_analyses"]["href"] == "/dashboard/logs"
    assert alerts_by_code["drilldown_404"]["href"] == "#ops-drilldown-details"
    assert alerts_by_code["trust_tickets_high"]["href"] == "#ops-ticket-details"


def test_product_drilldown_404_is_persisted_without_the_resource_identifier(client, db, auth_headers, monkeypatch):
    monkeypatch.setattr("app.middleware.operational_telemetry.settings.READ_ONLY_MODE", False)
    missing_id = uuid.uuid4()

    res = client.get(f"/api/v1/posts/{missing_id}", headers=auth_headers)

    assert res.status_code == 404
    events = db.query(OperationalEvent).all()
    assert len(events) == 1
    assert events[0].event_type == "drilldown_404"
    assert events[0].route_template == "/api/v1/posts/{post_id}"
    assert str(missing_id) not in events[0].route_template
