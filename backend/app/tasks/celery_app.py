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
    "daily-follower-snapshots": {
        "task": "app.tasks.pipeline_tasks.task_daily_follower_snapshots",
        "schedule": crontab(hour=3, minute=0),  # 3AM UTC daily
    },
    "daily-sync": {
        "task": "app.tasks.pipeline_tasks.task_daily_sync",
        "schedule": crontab(hour=3, minute=15),  # 3:15AM UTC daily (after snapshots)
    },
}

# Auto-discover tasks
celery_app.autodiscover_tasks(["app.tasks"])

# Explicit import to ensure tasks are registered
import app.tasks.pipeline_tasks  # noqa: F401, E402
