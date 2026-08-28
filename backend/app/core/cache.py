import json
import hashlib
import functools
import time
from typing import Optional
import redis
from app.core.config import settings

# Redis client (reuse the same Redis as Celery)
redis_client: Optional[redis.Redis] = None
redis_unavailable_until = 0.0
REDIS_TIMEOUT_SECONDS = 0.2
REDIS_RETRY_AFTER_SECONDS = 30.0


def get_redis() -> Optional[redis.Redis]:
    global redis_client, redis_unavailable_until
    if not settings.CACHE_REDIS_URL:
        return None
    if redis_client is None:
        now = time.monotonic()
        if redis_unavailable_until > now:
            return None
        try:
            redis_client = redis.from_url(
                settings.CACHE_REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=REDIS_TIMEOUT_SECONDS,
                socket_timeout=REDIS_TIMEOUT_SECONDS,
                retry_on_timeout=False,
            )
            redis_client.ping()
        except Exception:
            redis_client = None
            redis_unavailable_until = now + REDIS_RETRY_AFTER_SECONDS
    return redis_client


def cache_key(prefix: str, *args, **kwargs) -> str:
    from sqlalchemy.orm import Session as SASession
    filtered_args = [str(a) for a in args if not isinstance(a, SASession)]
    filtered_kwargs = {k: str(v) for k, v in sorted(kwargs.items()) if not isinstance(v, SASession)}
    key_data = json.dumps(
        {"args": filtered_args, "kwargs": filtered_kwargs},
        sort_keys=True,
    )
    hash_val = hashlib.md5(key_data.encode()).hexdigest()[:12]
    return f"cache:{prefix}:{hash_val}"


def cached(prefix: str, ttl: int = 300):
    """Decorator to cache function results in Redis. TTL in seconds (default 5min)."""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            r = get_redis()
            if r is None:
                return func(*args, **kwargs)

            key = cache_key(prefix, *args, **kwargs)
            try:
                cached_val = r.get(key)
                if cached_val:
                    return json.loads(cached_val)
            except Exception:
                pass

            result = func(*args, **kwargs)
            try:
                r.setex(key, ttl, json.dumps(result, default=str))
            except Exception:
                pass
            return result

        wrapper.invalidate = lambda *args, **kwargs: _invalidate(prefix, *args, **kwargs)
        return wrapper

    return decorator


def invalidate_pattern(pattern: str):
    """Invalidate all cache keys matching a pattern."""
    r = get_redis()
    if r:
        try:
            for key in r.scan_iter(f"cache:{pattern}:*"):
                r.delete(key)
        except Exception:
            pass


def _invalidate(prefix, *args, **kwargs):
    r = get_redis()
    if r:
        key = cache_key(prefix, *args, **kwargs)
        r.delete(key)
