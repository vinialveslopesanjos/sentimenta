"""Best-effort, low-cardinality telemetry for broken product drill-downs."""

import logging
import re
from collections.abc import Awaitable, Callable
from functools import lru_cache

from fastapi import Request, Response

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.operational_event import OperationalEvent

logger = logging.getLogger(__name__)

_DRILLDOWN_PREFIXES = (
    "/api/v1/dashboard/connection/",
    "/api/v1/data-snapshots/",
    "/api/v1/demographics/",
    "/api/v1/pipeline/runs/",
)
_PATH_PARAMETER = re.compile(r"\{[^/{}]+\}")


@lru_cache(maxsize=512)
def _template_pattern(template: str) -> re.Pattern[str]:
    """Compile an OpenAPI path template without exposing parameter values."""
    parts: list[str] = []
    cursor = 0
    for match in _PATH_PARAMETER.finditer(template):
        parts.append(re.escape(template[cursor : match.start()]))
        parts.append("[^/]+")
        cursor = match.end()
    parts.append(re.escape(template[cursor:]))
    return re.compile("^" + "".join(parts) + "$")


def _route_template(request: Request) -> str:
    # Function middleware does not receive the matched route in the outer
    # request scope on every Starlette/FastAPI version. Newer FastAPI versions
    # may also expose the original unprefixed route (for example
    # /posts/{post_id}). Resolve the public, fully-prefixed OpenAPI template
    # first instead of ever falling back to the raw URL, which could persist a
    # customer/resource identifier in telemetry.
    try:
        registered_paths = request.app.openapi().get("paths", {})
    except Exception:
        return ""

    method = request.method.lower()
    raw_path = request.url.path
    for candidate_template, operations in registered_paths.items():
        if method in operations and _template_pattern(str(candidate_template)).match(raw_path):
            return str(candidate_template)

    route = request.scope.get("route")
    template = getattr(route, "path", None)
    if template and _template_pattern(str(template)).match(raw_path):
        return str(template)

    return ""


def _is_product_drilldown(template: str) -> bool:
    if template == "/api/v1/posts/{post_id}":
        return True
    return template.startswith(_DRILLDOWN_PREFIXES)


def _record_drilldown_404(request: Request, template: str) -> None:
    session_factory = getattr(request.app.state, "operational_session_factory", SessionLocal)
    db = session_factory()
    try:
        db.add(
            OperationalEvent(
                event_type="drilldown_404",
                route_template=template,
                status_code=404,
                event_metadata={"method": request.method},
            )
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning("Unable to persist drill-down telemetry: %s", exc.__class__.__name__)
    finally:
        db.close()


async def capture_product_telemetry(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    response = await call_next(request)
    if (
        not settings.READ_ONLY_MODE
        and request.method == "GET"
        and response.status_code == 404
    ):
        template = _route_template(request)
        if _is_product_drilldown(template):
            _record_drilldown_404(request, template)
    return response
