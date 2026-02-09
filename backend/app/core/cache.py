import json
import hashlib
import functools
from typing import Optional
import redis
from app.core.config import settings

# Redis client (reuse the same Redis as Celery)
redis_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
            redis_client.ping()
        except Exception:
            redis_client = None
    return redis_client


def cache_key(prefix: str, *args, **kwargs) -> str:
    key_data = json.dumps(
        {
            "args": [str(a) for a in args],
            "kwargs": {k: str(v) for k, v in sorted(kwargs.items())},
        },
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
