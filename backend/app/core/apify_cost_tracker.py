"""
Apify daily cost tracker using Redis.

Tracks Apify spending per day with a configurable USD limit.
Uses Redis key `apify:cost:YYYY-MM-DD` with TTL 86400 (auto-expires).

After each Apify run, the actual cost (from Apify's API) is added to the
daily counter. Before each call, the counter is checked against the limit.
"""

import logging
import threading
from datetime import date

import httpx

from app.core.cache import get_redis
from app.core.config import settings

logger = logging.getLogger(__name__)

REDIS_KEY_PREFIX = "apify:cost"

# ── Acumulador por run de pipeline (P2.1) ────────────────────────────
# Processo prefork do Celery executa 1 task por vez, então um acumulador
# de processo é seguro; o lock cobre as threads do ThreadPoolExecutor
# usadas na coleta de comentários.
_run_cost_lock = threading.Lock()
_run_cost_total = 0.0


def reset_run_cost() -> None:
    """Zera o acumulador no início de uma run de pipeline."""
    global _run_cost_total
    with _run_cost_lock:
        _run_cost_total = 0.0


def get_run_cost() -> float:
    """Custo Apify acumulado desde o último reset_run_cost()."""
    with _run_cost_lock:
        return _run_cost_total


def _today_key() -> str:
    return f"{REDIS_KEY_PREFIX}:{date.today().isoformat()}"


def get_daily_spend() -> float:
    """Get current daily Apify spend in USD."""
    r = get_redis()
    if not r:
        return 0.0
    try:
        val = r.get(_today_key())
        return float(val) if val else 0.0
    except Exception as exc:
        logger.warning("Failed to read Apify daily spend from Redis: %s", exc)
        return 0.0


def add_cost(cost_usd: float) -> float:
    """Add cost to today's Apify spend counter. Returns new total."""
    if cost_usd <= 0:
        return get_daily_spend()

    # Acumula no custo da run atual mesmo se o Redis estiver fora
    global _run_cost_total
    with _run_cost_lock:
        _run_cost_total += cost_usd

    r = get_redis()
    if not r:
        return 0.0
    try:
        key = _today_key()
        # INCRBYFLOAT is atomic
        new_total = r.incrbyfloat(key, round(cost_usd, 6))
        # Set TTL only if not already set (first cost of the day)
        ttl = r.ttl(key)
        if ttl is None or ttl < 0:
            r.expire(key, 172800)  # 48h TTL (generous, key name has date anyway)
        return float(new_total)
    except Exception as exc:
        logger.warning("Failed to record Apify cost in Redis: %s", exc)
        return 0.0


def is_limit_reached() -> bool:
    """Check if the daily Apify cost limit has been reached."""
    limit = settings.APIFY_DAILY_LIMIT_USD
    if limit <= 0:
        return False  # No limit configured
    spent = get_daily_spend()
    if spent >= limit:
        logger.warning(
            "Apify daily limit reached ($%.2f/$%.2f), skipping scraping",
            spent, limit,
        )
        return True
    return False


def get_limit_status() -> dict:
    """Get current limit status (for logging/debugging)."""
    spent = get_daily_spend()
    limit = settings.APIFY_DAILY_LIMIT_USD
    return {
        "spent_usd": round(spent, 4),
        "limit_usd": limit,
        "remaining_usd": round(max(0, limit - spent), 4),
        "limit_reached": spent >= limit if limit > 0 else False,
    }


def fetch_last_run_cost(actor_id: str) -> float:
    """Fetch the cost of the last run for a given actor from Apify API.

    Returns the cost in USD, or 0.0 if unavailable.
    """
    token = settings.APIFY_API_TOKEN
    if not token:
        return 0.0

    try:
        url = f"https://api.apify.com/v2/acts/{actor_id}/runs/last"
        with httpx.Client(timeout=10) as client:
            resp = client.get(url, params={"token": token})
            resp.raise_for_status()
            data = resp.json().get("data", {})

        cost = data.get("usageTotalUsd", 0.0)
        if cost:
            return float(cost)
        return 0.0
    except Exception as exc:
        logger.debug("Failed to fetch last run cost for %s: %s", actor_id, exc)
        return 0.0
