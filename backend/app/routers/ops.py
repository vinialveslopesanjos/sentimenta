"""Authenticated operational health endpoints."""

from datetime import datetime, timedelta, timezone

import redis
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.pipeline_run import PipelineRun
from app.models.user import User
from app.tasks.celery_app import celery_app

router = APIRouter(prefix="/ops", tags=["ops"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.plan != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_required")
    return current_user


def _redis_status(url: str) -> dict:
    if not url:
        return {"ok": False, "error": "not_configured"}
    try:
        client = redis.from_url(url, decode_responses=True)
        client.ping()
        return {
            "ok": True,
            "used_memory_bytes": int(client.info("memory").get("used_memory", 0)),
            "connected_clients": int(client.info("clients").get("connected_clients", 0)),
        }
    except Exception as exc:
        return {"ok": False, "error": exc.__class__.__name__}


def _celery_status() -> dict:
    try:
        inspect = celery_app.control.inspect(timeout=2)
        pings = inspect.ping() or {}
    except Exception as exc:
        return {"ok": False, "error": exc.__class__.__name__, "workers": 0, "queue_depth": None}

    queue_depth = None
    try:
        client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
        queue_depth = int(client.llen("celery"))
    except Exception:
        queue_depth = None

    return {
        "ok": bool(pings),
        "workers": len(pings),
        "worker_names": sorted(pings.keys()),
        "queue_depth": queue_depth,
    }


@router.get("/health")
def operational_health(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    now = datetime.now(timezone.utc)
    stale_cutoff = now - timedelta(hours=2)
    recent_cutoff = now - timedelta(hours=24)

    database = {"ok": True}
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        database = {"ok": False, "error": exc.__class__.__name__}

    celery = _celery_status()
    redis_status = {
        "cache": _redis_status(settings.CACHE_REDIS_URL),
        "rate_limit": _redis_status(settings.RATE_LIMIT_REDIS_URL),
        "broker": _redis_status(settings.CELERY_BROKER_URL),
        "result_backend": _redis_status(settings.CELERY_RESULT_BACKEND),
    }

    pipeline = {
        "running": None,
        "stale_running": None,
        "failed_24h": None,
        "partial_24h": None,
    }
    if database["ok"]:
        pipeline = {
            "running": db.query(PipelineRun).filter(PipelineRun.status == "running").count(),
            "stale_running": (
                db.query(PipelineRun)
                .filter(PipelineRun.status == "running", PipelineRun.started_at < stale_cutoff)
                .count()
            ),
            "failed_24h": (
                db.query(PipelineRun)
                .filter(PipelineRun.status == "failed", PipelineRun.started_at >= recent_cutoff)
                .count()
            ),
            "partial_24h": (
                db.query(PipelineRun)
                .filter(PipelineRun.status == "partial", PipelineRun.started_at >= recent_cutoff)
                .count()
            ),
        }

    degraded = (
        not database["ok"]
        or not celery["ok"]
        or (pipeline["stale_running"] or 0) > 0
        or any(not item["ok"] for item in redis_status.values())
    )

    return {
        "status": "degraded" if degraded else "ok",
        "generated_at": now.isoformat(),
        "database": database,
        "redis": redis_status,
        "celery": celery,
        "pipeline": pipeline,
    }
