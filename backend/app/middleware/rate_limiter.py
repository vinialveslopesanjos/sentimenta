import time
from collections import defaultdict
from typing import Optional

from fastapi import HTTPException
import redis

from app.core.config import settings


rate_limit_redis_client: Optional[redis.Redis] = None
rate_limit_redis_unavailable_until = 0.0
REDIS_TIMEOUT_SECONDS = 0.2
REDIS_RETRY_AFTER_SECONDS = 30.0


def get_rate_limit_redis() -> Optional[redis.Redis]:
    global rate_limit_redis_client, rate_limit_redis_unavailable_until
    if not settings.RATE_LIMIT_REDIS_URL:
        return None
    if rate_limit_redis_client is None:
        now = time.monotonic()
        if rate_limit_redis_unavailable_until > now:
            return None
        try:
            rate_limit_redis_client = redis.from_url(
                settings.RATE_LIMIT_REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=REDIS_TIMEOUT_SECONDS,
                socket_timeout=REDIS_TIMEOUT_SECONDS,
                retry_on_timeout=False,
            )
            rate_limit_redis_client.ping()
        except Exception:
            rate_limit_redis_client = None
            rate_limit_redis_unavailable_until = now + REDIS_RETRY_AFTER_SECONDS
    return rate_limit_redis_client


class RateLimiter:
    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int, window_seconds: int):
        redis_client = get_rate_limit_redis()
        if redis_client:
            return self._check_redis(redis_client, key, max_requests, window_seconds)
        return self._check_memory(key, max_requests, window_seconds)

    def _check_memory(self, key: str, max_requests: int, window_seconds: int):
        now = time.time()
        self._requests[key] = [t for t in self._requests[key] if now - t < window_seconds]
        if len(self._requests[key]) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {window_seconds} seconds.",
            )
        self._requests[key].append(now)

    def _check_redis(self, redis_client, key: str, max_requests: int, window_seconds: int):
        now_ms = int(time.time() * 1000)
        window_start = now_ms - (window_seconds * 1000)
        redis_key = f"rate_limit:{key}"
        member = f"{now_ms}:{time.perf_counter_ns()}"
        pipeline = redis_client.pipeline()
        pipeline.zremrangebyscore(redis_key, 0, window_start)
        pipeline.zadd(redis_key, {member: now_ms})
        pipeline.zcard(redis_key)
        pipeline.expire(redis_key, window_seconds)
        _, _, request_count, _ = pipeline.execute()
        if int(request_count) > max_requests:
            redis_client.zrem(redis_key, member)
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {window_seconds} seconds.",
            )


rate_limiter = RateLimiter()
