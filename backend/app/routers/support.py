"""Support contact form endpoint."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.services.email_service import send_support_contact_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/support", tags=["support"])


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str


@router.post("/contact")
def contact_support(payload: ContactRequest):
    """Public endpoint — receives support form submissions and emails them."""
    logger.info(f"Support contact from {payload.email}: {payload.subject}")

    sent = send_support_contact_email(
        name=payload.name,
        email=payload.email,
        subject=payload.subject,
        message=payload.message,
    )

    if not sent:
        raise HTTPException(status_code=503, detail="Não foi possível enviar o email. Tente novamente mais tarde.")

    return {"message": "Mensagem enviada com sucesso. Retornaremos em até 24h úteis."}
