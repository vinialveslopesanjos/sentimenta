import time
from collections import defaultdict
from fastapi import HTTPException

from app.core.cache import get_redis


class RateLimiter:
    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int, window_seconds: int):
        redis_client = get_redis()
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
        pipeline = redis_client.pipeline()
        pipeline.zremrangebyscore(redis_key, 0, window_start)
        pipeline.zadd(redis_key, {str(now_ms): now_ms})
        pipeline.zcard(redis_key)
        pipeline.expire(redis_key, window_seconds)
        _, _, request_count, _ = pipeline.execute()
        if int(request_count) > max_requests:
            redis_client.zrem(redis_key, str(now_ms))
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {window_seconds} seconds.",
            )


rate_limiter = RateLimiter()
