"""
Server-side PostHog analytics for Sentimenta.

Captures events that only the backend can see: sync completions,
credit consumption, subscription changes, etc.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    try:
        from posthog import Posthog
        from app.core.config import settings
        if settings.POSTHOG_API_KEY:
            _client = Posthog(
                project_api_key=settings.POSTHOG_API_KEY,
                host=settings.POSTHOG_HOST,
            )
        else:
            _client = False  # Mark as "no key, don't retry"
    except Exception as e:
        logger.warning("PostHog init failed: %s", e)
        _client = False
    return _client


def capture(
    user_id: str,
    event: str,
    properties: Optional[dict] = None,
):
    """Capture an event in PostHog. Non-blocking, never raises."""
    try:
        client = _get_client()
        if not client:
            return
        client.capture(
            distinct_id=str(user_id),
            event=event,
            properties=properties or {},
        )
    except Exception as e:
        logger.debug("PostHog capture failed: %s", e)


def identify(
    user_id: str,
    properties: Optional[dict] = None,
):
    """Identify a user in PostHog with traits."""
    try:
        client = _get_client()
        if not client:
            return
        client.identify(
            distinct_id=str(user_id),
            properties=properties or {},
        )
    except Exception as e:
        logger.debug("PostHog identify failed: %s", e)
