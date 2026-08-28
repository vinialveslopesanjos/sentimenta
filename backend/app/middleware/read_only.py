from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.config import settings


SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _allowed_unsafe_paths() -> set[str]:
    return {
        f"{settings.API_PREFIX}/auth/login",
        f"{settings.API_PREFIX}/auth/refresh",
    }


async def read_only_guard(request: Request, call_next):
    if not settings.READ_ONLY_MODE or request.method in SAFE_METHODS:
        return await call_next(request)

    if request.url.path in _allowed_unsafe_paths():
        return await call_next(request)

    return JSONResponse(
        status_code=403,
        content={
            "detail": (
                "Read-only mode is enabled for this environment. "
                "Write operations are blocked."
            )
        },
    )
