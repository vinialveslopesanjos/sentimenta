"""Public lead capture endpoints."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.diagnostic_lead import DiagnosticLead
from app.services.email_service import send_support_contact_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/leads", tags=["leads"])


class DiagnosticLeadRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    role: str = Field(min_length=1, max_length=64)
    profile_or_post: str = Field(min_length=2, max_length=2000)
    context: str | None = Field(default=None, max_length=4000)
    source_path: str | None = Field(default=None, max_length=2000)
    attribution: dict | None = None
    website: str | None = Field(default=None, max_length=255)


@router.post("/diagnostic")
def create_diagnostic_lead(
    payload: DiagnosticLeadRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Capture a diagnostic request before attempting email notification."""
    from app.middleware.rate_limiter import rate_limiter

    client_ip = request.client.host if request.client else "unknown"
    normalized_email = str(payload.email).lower()
    rate_limiter.check(f"diagnostic_lead:ip:{client_ip}", max_requests=8, window_seconds=3600)
    rate_limiter.check(f"diagnostic_lead:email:{normalized_email}", max_requests=3, window_seconds=86400)

    if payload.website:
        raise HTTPException(status_code=400, detail="Invalid submission")

    lead = DiagnosticLead(
        name=payload.name.strip(),
        email=normalized_email,
        role=payload.role.strip(),
        profile_or_post=payload.profile_or_post.strip(),
        context=payload.context.strip() if payload.context else None,
        source_path=payload.source_path,
        attribution=payload.attribution,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    message = "\n".join(
        [
            "Pedido de diagnostico gratuito do Sentimenta.",
            "",
            f"Lead ID: {lead.id}",
            f"Perfil/post publico: {lead.profile_or_post}",
            f"Perfil do lead: {lead.role}",
            f"Origem: {lead.source_path or request.headers.get('referer') or 'Nao informada'}",
            "",
            "Contexto informado:",
            lead.context or "Nao informado.",
            "",
            "Attribution/UTM:",
            str(lead.attribution or {}),
        ]
    )

    try:
        sent = send_support_contact_email(
            name=lead.name,
            email=lead.email,
            subject=f"[Diagnostico Sentimenta] {lead.role} - {lead.profile_or_post[:80]}",
            message=message,
        )
        if sent:
            lead.email_sent_at = datetime.now(timezone.utc)
        else:
            lead.email_error = "send_support_contact_email returned false"
    except Exception as exc:
        logger.warning("Diagnostic lead email notification failed for %s: %s", lead.id, exc)
        lead.email_error = str(exc)[:2000]

    db.add(lead)
    db.commit()

    return {
        "id": str(lead.id),
        "message": "Pedido recebido. Retornaremos com o diagnostico em breve.",
        "email_sent": lead.email_sent_at is not None,
    }
