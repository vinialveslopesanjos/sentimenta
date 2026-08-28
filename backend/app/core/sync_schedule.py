"""Shared schedule contract for Celery Beat and user-visible connection health."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


DAILY_SYNC_HOUR_UTC = 3
DAILY_SYNC_MINUTE_UTC = 15
WEEKLY_SYNC_HOUR_UTC = 3
WEEKLY_SYNC_MINUTE_UTC = 25
WEEKLY_SYNC_CELERY_DAY_OF_WEEK = 1  # Celery: Monday
WEEKLY_SYNC_PYTHON_WEEKDAY = 0  # datetime: Monday


def _aware(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def next_scheduled_sync_at(
    frequency: str,
    *,
    now: datetime | None = None,
) -> datetime | None:
    """Return the next Beat slot for a plan frequency, always in UTC."""
    now_utc = _aware(now)

    if frequency == "daily":
        candidate = now_utc.replace(
            hour=DAILY_SYNC_HOUR_UTC,
            minute=DAILY_SYNC_MINUTE_UTC,
            second=0,
            microsecond=0,
        )
        if candidate <= now_utc:
            candidate += timedelta(days=1)
        return candidate

    if frequency == "weekly":
        days_until_monday = (WEEKLY_SYNC_PYTHON_WEEKDAY - now_utc.weekday()) % 7
        candidate = (now_utc + timedelta(days=days_until_monday)).replace(
            hour=WEEKLY_SYNC_HOUR_UTC,
            minute=WEEKLY_SYNC_MINUTE_UTC,
            second=0,
            microsecond=0,
        )
        if candidate <= now_utc:
            candidate += timedelta(days=7)
        return candidate

    return None
