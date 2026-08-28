from celery import Celery
from celery.schedules import crontab
from app.core.config import settings
from app.core.sync_schedule import (
    DAILY_SYNC_HOUR_UTC,
    DAILY_SYNC_MINUTE_UTC,
    WEEKLY_SYNC_CELERY_DAY_OF_WEEK,
    WEEKLY_SYNC_HOUR_UTC,
    WEEKLY_SYNC_MINUTE_UTC,
)

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
        "schedule": crontab(
            hour=WEEKLY_SYNC_HOUR_UTC,
            minute=WEEKLY_SYNC_MINUTE_UTC,
            day_of_week=WEEKLY_SYNC_CELERY_DAY_OF_WEEK,
        ),
        "kwargs": {"frequency_filter": "weekly"},
    },
    "daily-sync": {
        "task": "app.tasks.pipeline_tasks.task_daily_sync",
        "schedule": crontab(hour=DAILY_SYNC_HOUR_UTC, minute=DAILY_SYNC_MINUTE_UTC),
        "kwargs": {"frequency_filter": "daily"},
    },
}

# Auto-discover tasks
celery_app.autodiscover_tasks(["app.tasks"])

# Explicit import to ensure tasks are registered
import app.tasks.pipeline_tasks  # noqa: F401, E402
