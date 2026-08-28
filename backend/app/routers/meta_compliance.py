"""Callbacks de compliance exigidos pelo Meta App Review.

- Deauthorize: usuário removeu o app no Instagram → revogamos tokens.
- Data Deletion: usuário pediu exclusão → apagamos os dados e devolvemos
  {url, confirmation_code} como a Meta especifica.
Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
"""

import base64
import hashlib
import hmac
import json
import logging
import secrets as pysecrets

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.orm import Session

from app.core.cache import get_redis
from app.core.config import settings
from app.db.session import get_db
from app.models.social_connection import SocialConnection
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meta", tags=["meta-compliance"])

DELETION_RECORD_TTL = 90 * 24 * 3600  # 90 dias consultável


def _b64url_decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _parse_signed_request(signed_request: str) -> dict:
    """Valida o signed_request da Meta (HMAC-SHA256 com o app secret)."""
    try:
        sig_b64, payload_b64 = signed_request.split(".", 1)
        sig = _b64url_decode(sig_b64)
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception:
        raise HTTPException(status_code=400, detail="signed_request malformado")

    expected = hmac.new(
        settings.INSTAGRAM_APP_SECRET.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=400, detail="Assinatura inválida")
    return payload


def _find_instagram_connection(db: Session, ig_user_id: str) -> SocialConnection | None:
    return (
        db.query(SocialConnection)
        .filter(
            SocialConnection.platform == "instagram",
            SocialConnection.platform_user_id == str(ig_user_id),
        )
        .first()
    )


@router.post("/deauthorize")
def meta_deauthorize(
    signed_request: str = Form(...),
    db: Session = Depends(get_db),
):
    payload = _parse_signed_request(signed_request)
    ig_user_id = payload.get("user_id")
    conn = _find_instagram_connection(db, ig_user_id) if ig_user_id else None
    if conn:
        conn.status = "revoked"
        conn.access_token_enc = None
        conn.refresh_token_enc = None
        conn.auto_sync = False
        db.commit()
        logger.info("Meta deauthorize: connection %s (@%s) revogada", conn.id, conn.username)
    return {"success": True}


@router.post("/data-deletion")
def meta_data_deletion(
    signed_request: str = Form(...),
    db: Session = Depends(get_db),
):
    payload = _parse_signed_request(signed_request)
    ig_user_id = payload.get("user_id")
    code = pysecrets.token_urlsafe(16)

    deleted = "no_data"
    conn = _find_instagram_connection(db, ig_user_id) if ig_user_id else None
    if conn:
        user: User | None = db.get(User, conn.user_id)
        # Apaga a conexão (cascata remove posts/comentários/análises)
        db.delete(conn)
        db.flush()
        deleted = "connection_data"

        # Conta criada só via login social do Instagram (sem senha) e sem
        # outras conexões: apaga o usuário inteiro (mesma rotina da LGPD).
        if user and not user.password_hash and not user.google_id:
            remaining = (
                db.query(SocialConnection)
                .filter(SocialConnection.user_id == user.id)
                .count()
            )
            if remaining == 0:
                from app.models.credits import CreditBalance, CreditTransaction
                from app.models.demographics import UsageLog

                for model in (CreditTransaction, CreditBalance, UsageLog):
                    db.query(model).filter(model.user_id == user.id).delete(
                        synchronize_session=False
                    )
                db.delete(user)
                deleted = "full_account"
        db.commit()
        logger.info("Meta data deletion: ig_user=%s scope=%s code=%s", ig_user_id, deleted, code)

    r = get_redis()
    if r:
        try:
            r.setex(
                f"meta_deletion:{code}",
                DELETION_RECORD_TTL,
                json.dumps({"status": "completed", "scope": deleted}),
            )
        except Exception as exc:
            logger.warning("Failed to store deletion record: %s", exc)

    return {
        "url": f"https://sentimenta.com.br/exclusao-de-dados?code={code}",
        "confirmation_code": code,
    }


@router.get("/deletion-status/{code}")
def deletion_status(code: str):
    r = get_redis()
    if r:
        try:
            raw = r.get(f"meta_deletion:{code}")
            if raw:
                data = json.loads(raw)
                return {"code": code, **data}
        except Exception:
            pass
    # Registro expirado (90d) ou desconhecido — exclusões são executadas na
    # hora, então respondemos concluído sem detalhes.
    return {"code": code, "status": "completed", "scope": "unknown"}
