"""Endpoints públicos (sem autenticação) — Prévia Mágica de onboarding."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.analytics import capture
from app.db.session import get_db
from app.middleware.rate_limiter import rate_limiter
from app.services import preview_service
from app.services.preview_service import PreviewError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["public"])

# Rate-limit por IP: prévias custam Apify (IG) — cache por @ absorve o viral,
# mas o teto por IP protege contra abuso de @s distintos.
PREVIEW_RATE_MAX = 5
PREVIEW_RATE_WINDOW = 3600  # 1h


class PreviewRequest(BaseModel):
    platform: str = Field(..., pattern=r"^(youtube|instagram)$")
    handle: str = Field(..., min_length=1, max_length=120)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/preview")
def public_preview(
    body: PreviewRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Análise pública anônima de um @ — o gancho do onboarding.

    Cache hit não conta no rate-limit (viral barato); só a geração real gasta cota.
    """
    platform = body.platform.lower()
    handle = body.handle.strip()

    cached = preview_service.get_cached_preview(platform, handle)
    if cached:
        cached["cached"] = True
        capture("anonymous", "preview_generated", {"platform": platform, "cached": True})
        return cached

    # Só limita quando vai realmente gerar (gastar Apify/LLM)
    rate_limiter.check(f"preview:{_client_ip(request)}", PREVIEW_RATE_MAX, PREVIEW_RATE_WINDOW)

    try:
        result = preview_service.run_preview(db, platform, handle)
    except PreviewError as e:
        capture("anonymous", "preview_failed", {"platform": platform, "code": e.code})
        raise HTTPException(status_code=422, detail={"code": e.code, "message": e.message})
    except Exception:
        logger.exception("Preview failed for %s:%s", platform, handle)
        raise HTTPException(status_code=502, detail={"code": "error", "message": "Falha ao gerar a prévia. Tente de novo."})

    capture("anonymous", "preview_generated", {"platform": platform, "cached": False})
    return result


@router.get("/preview/{platform}/{handle}")
def public_preview_get(
    platform: str,
    handle: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Versão GET para a página compartilhável /preview/{platform}/{handle}.

    Serve do cache quando existe; senão gera (com rate-limit por IP).
    """
    platform = platform.lower()
    if platform not in ("youtube", "instagram"):
        raise HTTPException(status_code=404, detail="Plataforma não suportada.")

    cached = preview_service.get_cached_preview(platform, handle)
    if cached:
        cached["cached"] = True
        return cached

    rate_limiter.check(f"preview:{_client_ip(request)}", PREVIEW_RATE_MAX, PREVIEW_RATE_WINDOW)
    try:
        return preview_service.run_preview(db, platform, handle)
    except PreviewError as e:
        raise HTTPException(status_code=422, detail={"code": e.code, "message": e.message})
    except Exception:
        logger.exception("Preview GET failed for %s:%s", platform, handle)
        raise HTTPException(status_code=502, detail={"code": "error", "message": "Falha ao gerar a prévia."})
