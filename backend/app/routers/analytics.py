"""First-party web analytics capture.

The frontend posts page views and click events here so ad blockers and cookie
consent do not erase the acquisition funnel. The endpoint never stores browser
cookies and does not send raw IP addresses to PostHog.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.analytics import capture
from app.core.config import settings
from app.core.security import decode_token, token_version_matches
from app.db.session import get_db
from app.middleware.rate_limiter import rate_limiter
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])

ALLOWED_QUERY_KEYS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_term",
    "utm_content",
    "gclid",
    "gbraid",
    "wbraid",
    "msclkid",
}
ALLOWED_HOSTS = {
    "sentimenta.com.br",
    "www.sentimenta.com.br",
    "app.sentimenta.com.br",
    "localhost",
    "127.0.0.1",
}
MAX_PROPS = 40
EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_RE = re.compile(r"\+?\d[\d ().-]{7,}\d")


class WebTelemetryPayload(BaseModel):
    type: Literal["page_view", "click", "custom"]
    event: str | None = Field(default=None, min_length=1, max_length=80)
    path: str = Field(min_length=1, max_length=500)
    url: str = Field(min_length=1, max_length=2000)
    title: str | None = Field(default=None, max_length=200)
    referrer: str | None = Field(default=None, max_length=2000)
    attribution: dict[str, Any] | None = None
    consent_state: Literal["accepted", "declined", "pending"] = "pending"
    client_telemetry_id: str | None = Field(default=None, max_length=80)
    properties: dict[str, Any] | None = None
    target: dict[str, Any] | None = None

    @field_validator("event")
    @classmethod
    def event_name_is_safe(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not all(ch.isalnum() or ch in "_-$:" for ch in value):
            raise ValueError("invalid event name")
        return value


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _safe_scalar(value: Any, max_len: int = 300) -> Any:
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        clean = value.replace("\x00", "").strip()
        clean = EMAIL_RE.sub("[email]", clean)
        clean = PHONE_RE.sub("[phone]", clean)
        return clean[:max_len]
    return _safe_scalar(str(value), max_len=max_len)


def _sanitize_dict(value: dict[str, Any] | None) -> dict[str, Any]:
    if not value:
        return {}
    clean: dict[str, Any] = {}
    for key, raw in list(value.items())[:MAX_PROPS]:
        safe_key = "".join(ch for ch in str(key) if ch.isalnum() or ch in "_-$:.")[:80]
        if not safe_key:
            continue
        clean[safe_key] = _safe_scalar(raw)
    return clean


def _sanitize_target(value: dict[str, Any] | None) -> dict[str, Any]:
    clean = _sanitize_dict(value)
    href_path = clean.get("href_path")
    if isinstance(href_path, str):
        parsed = urlparse(href_path)
        clean["href_path"] = (parsed.path or "/")[:500]
    return clean


def _sanitize_url(raw_url: str) -> tuple[str, str, str]:
    parsed = urlparse(raw_url)
    hostname = (parsed.hostname or "").lower()
    scheme = parsed.scheme if parsed.scheme in {"http", "https"} else "https"
    if hostname not in ALLOWED_HOSTS:
        hostname = "sentimenta.com.br"
        path = "/"
    else:
        path = parsed.path or "/"

    safe_query = [
        (key, value[:200])
        for key, value in parse_qsl(parsed.query, keep_blank_values=False)
        if key in ALLOWED_QUERY_KEYS
    ]
    query = urlencode(safe_query)
    safe_url = urlunparse((scheme, hostname, path, "", query, ""))
    return safe_url, path[:500], hostname


def _sanitize_referrer(raw_url: str | None) -> str | None:
    if not raw_url:
        return None
    parsed = urlparse(raw_url)
    if not parsed.hostname:
        return None
    return urlunparse((parsed.scheme if parsed.scheme in {"http", "https"} else "https", parsed.hostname, parsed.path or "/", "", "", ""))


def _optional_user(request: Request, db: Session) -> User | None:
    auth_header = request.headers.get("authorization", "")
    token = ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    token = token or request.cookies.get("sentimenta_access_token", "")
    if not token:
        return None

    try:
        payload = decode_token(token)
        if payload is None or payload.get("type") != "access":
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        if user is None or not token_version_matches(payload, user.token_version):
            return None
        return user
    except Exception:
        return None


def _anonymous_distinct_id(request: Request, hostname: str, payload: WebTelemetryPayload) -> tuple[str, str]:
    if payload.client_telemetry_id:
        digest = hashlib.sha256(payload.client_telemetry_id.encode("utf-8")).hexdigest()[:32]
        return f"web:{digest}", "client_memory"

    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    material = f"{day}|{_client_ip(request)}|{request.headers.get('user-agent', '')}|{hostname}"
    digest = hmac.new(settings.SECRET_KEY.encode("utf-8"), material.encode("utf-8"), hashlib.sha256).hexdigest()[:32]
    return f"anon:{digest}", "anonymous_daily_hash"


@router.post("/web", status_code=status.HTTP_202_ACCEPTED)
def capture_web_event(
    payload: WebTelemetryPayload,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Capture public web analytics without relying on browser cookies."""
    client_ip = _client_ip(request)
    rate_limiter.check(f"web_analytics:ip:{client_ip}", max_requests=600, window_seconds=300)

    safe_url, safe_path, hostname = _sanitize_url(payload.url)
    safe_referrer = _sanitize_referrer(payload.referrer)
    user = _optional_user(request, db)

    if user:
        distinct_id = str(user.id)
        distinct_source = "authenticated_user"
    else:
        distinct_id, distinct_source = _anonymous_distinct_id(request, hostname, payload)

    attribution = _sanitize_dict(payload.attribution)
    properties = {
        "source": "sentimenta_web",
        "tracking_mode": "first_party_server",
        "event_type": payload.type,
        "consent_state": payload.consent_state,
        "distinct_source": distinct_source,
        "is_authenticated": bool(user),
        "$current_url": safe_url,
        "$pathname": safe_path,
        "$host": hostname,
        "$referrer": safe_referrer,
        "page_title": _safe_scalar(payload.title, 200),
        "path": safe_path,
        **{f"attr_{key}": value for key, value in attribution.items()},
        **_sanitize_dict(payload.properties),
    }
    if user:
        properties["user_plan"] = user.plan

    if payload.type == "page_view":
        capture(distinct_id, "$pageview", properties)
    elif payload.type == "click":
        capture(distinct_id, "web_click", {**properties, **{f"target_{k}": v for k, v in _sanitize_target(payload.target).items()}})
    else:
        capture(distinct_id, payload.event or "web_custom_event", properties)

    response.headers["Cache-Control"] = "no-store"
    return {"ok": True}
