"""Security telemetry endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/security", tags=["security"])


@router.post("/csp-report", status_code=204)
async def receive_csp_report(request: Request):
    """Receive browser CSP violation reports without persisting sensitive payloads."""
    from app.middleware.rate_limiter import rate_limiter

    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"csp_report:{client_ip}", max_requests=120, window_seconds=300)

    payload: dict[str, Any] = await request.json()
    report = payload.get("csp-report") if isinstance(payload, dict) else None
    if isinstance(report, dict):
        logger.warning(
            "CSP violation blocked_uri=%s violated_directive=%s document_uri=%s",
            str(report.get("blocked-uri", ""))[:300],
            str(report.get("violated-directive", ""))[:200],
            str(report.get("document-uri", ""))[:300],
        )
    else:
        logger.warning("CSP violation report received with unexpected payload")
    return None
