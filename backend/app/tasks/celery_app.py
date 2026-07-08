import logging

# httpx loga a URL completa das requests (incluindo ?token=...) no nível INFO.
# WARNING evita vazar o token do Apify nos logs do worker/api.
logging.getLogger("httpx").setLevel(logging.WARNING)

from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "sentiment_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    "refresh-social-tokens": {
        "task": "app.tasks.pipeline_tasks.task_refresh_social_tokens",
        "schedule": crontab(hour=2, minute=30),  # 2:30AM UTC (before daily sync)
    },
    "daily-follower-snapshots": {
        "task": "app.tasks.pipeline_tasks.task_daily_follower_snapshots",
        "schedule": crontab(hour=3, minute=0),  # 3AM UTC daily
        "options": {"soft_time_limit": 300, "time_limit": 360},
    },
    "weekly-sync": {
        "task": "app.tasks.pipeline_tasks.task_daily_sync",
        "schedule": crontab(hour=3, minute=25, day_of_week=1),  # Monday 3:25AM - Free/Starter (offset from daily)
        "kwargs": {"frequency_filter": "weekly"},
    },
    "daily-sync": {
        "task": "app.tasks.pipeline_tasks.task_daily_sync",
        "schedule": crontab(hour=3, minute=15),  # Daily 3:15AM - Pro/Business/Enterprise
        "kwargs": {"frequency_filter": "daily"},
    },
    "reconcile-stale-runs": {
        "task": "app.tasks.pipeline_tasks.task_reconcile_stale_runs",
        "schedule": crontab(minute="*/30"),  # runs presas nunca ficam >4h30 na UI
        "options": {"soft_time_limit": 120, "time_limit": 180},
    },
}

# Auto-discover tasks
celery_app.autodiscover_tasks(["app.tasks"])

# Explicit import to ensure tasks are registered
import app.tasks.pipeline_tasks  # noqa: F401, E402
