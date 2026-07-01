"""Container healthcheck commands.

These commands intentionally return only process/dependency health and do not
print secrets or provider payloads.
"""

import os
import socket
import sys
from pathlib import Path

import redis

from app.core.config import settings
from app.tasks.celery_app import celery_app


def _redis_ping(url: str) -> bool:
    if not url:
        return False
    client = redis.from_url(url, decode_responses=True)
    return bool(client.ping())


def check_worker() -> int:
    hostname = socket.gethostname()
    destination = os.getenv("CELERY_WORKER_HEALTHCHECK_DESTINATION", f"worker@{hostname}")
    replies = celery_app.control.inspect(destination=[destination], timeout=5).ping() or {}
    return 0 if replies else 1


def check_beat() -> int:
    cmdline = Path("/proc/1/cmdline")
    if cmdline.exists():
        process_cmd = cmdline.read_text(errors="ignore").replace("\x00", " ")
        if "celery" not in process_cmd or "beat" not in process_cmd:
            return 1
    try:
        return 0 if _redis_ping(settings.CELERY_BROKER_URL) else 1
    except Exception:
        return 1


def check_redis() -> int:
    urls = {
        settings.CELERY_BROKER_URL,
        settings.CELERY_RESULT_BACKEND,
        settings.CACHE_REDIS_URL,
        settings.RATE_LIMIT_REDIS_URL,
    }
    try:
        return 0 if all(_redis_ping(url) for url in urls if url) else 1
    except Exception:
        return 1


def main() -> int:
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "worker":
        return check_worker()
    if command == "beat":
        return check_beat()
    if command == "redis":
        return check_redis()
    print("usage: python -m app.ops.healthchecks [worker|beat|redis]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
