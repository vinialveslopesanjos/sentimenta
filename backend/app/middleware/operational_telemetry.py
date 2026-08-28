"""Best-effort, low-cardinality telemetry for broken product drill-downs."""

import logging
from collections.abc import Awaitable, Callable

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


def _route_template(request: Request) -> str:
    route = request.scope.get("route")
    template = getattr(route, "path", None)
    return str(template or request.url.path)


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
