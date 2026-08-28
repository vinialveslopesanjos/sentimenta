"""Support contact form endpoint."""

import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.support_ticket import SupportTicket
from app.services.email_service import send_support_contact_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/support", tags=["support"])


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    category: Literal["data_trust", "collection_sync", "account_access", "billing", "other"] = "other"
    subject: str = Field(min_length=2, max_length=255)
    message: str = Field(min_length=2, max_length=10000)
    source_path: str | None = Field(default=None, max_length=500)


@router.post("/contact")
def contact_support(
    payload: ContactRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Persist a support request before attempting the email notification."""
    from app.middleware.rate_limiter import rate_limiter

    client_ip = request.client.host if request.client else "unknown"
    normalized_email = str(payload.email).lower()
    rate_limiter.check(f"support:ip:{client_ip}", max_requests=8, window_seconds=3600)
    rate_limiter.check(f"support:email:{normalized_email}", max_requests=3, window_seconds=86400)

    ticket = SupportTicket(
        name=payload.name.strip(),
        email=normalized_email,
        category=payload.category,
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        source_path=(payload.source_path or request.headers.get("referer") or "")[:500] or None,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    try:
        sent = send_support_contact_email(
            name=ticket.name,
            email=ticket.email,
            subject=ticket.subject,
            message=ticket.message,
        )
        if sent:
            ticket.email_sent_at = datetime.now(timezone.utc)
        else:
            ticket.email_error = "send_support_contact_email returned false"
    except Exception as exc:
        logger.warning("Support notification failed for ticket %s: %s", ticket.id, exc.__class__.__name__)
        ticket.email_error = exc.__class__.__name__

    db.add(ticket)
    db.commit()
    logger.info("Support ticket %s persisted in category %s", ticket.id, ticket.category)

    return {
        "id": str(ticket.id),
        "message": "Mensagem recebida. Retornaremos em até 24h úteis.",
        "email_sent": ticket.email_sent_at is not None,
    }
