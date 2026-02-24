"""
Email Service — Resend.com integration

Handles all transactional emails for Sentimenta.
Requires RESEND_API_KEY in .env

Install: pip install resend
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def _get_resend():
    """Lazy-import resend to avoid crash when not installed."""
    try:
        import resend as _resend
        api_key = os.getenv("RESEND_API_KEY", "")
        if not api_key:
            logger.warning("RESEND_API_KEY not set — emails will be skipped")
            return None
        _resend.api_key = api_key
        return _resend
    except ImportError:
        logger.warning("resend package not installed — pip install resend")
        return None


FROM_ADDRESS = os.getenv("EMAIL_FROM", "noreply@sentimenta.com.br")
APP_URL = os.getenv("APP_URL", "https://app.sentimenta.com.br")


def send_welcome_email(email: str, name: Optional[str] = None) -> bool:
    """
    Send welcome email after registration.
    Called in: auth_service.register_user()
    """
    resend = _get_resend()
    if not resend:
        return False

    display_name = name or "criador"

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": email,
            "subject": "Bem-vindo à Sentimenta 👋",
            "html": f"""
<!DOCTYPE html>
<html>
<body style="font-family: 'Inter', sans-serif; background: #0f0e17; color: #fffffe; padding: 32px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #C4B5FD, #67E8F9); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <h1 style="color: #0f0e17; margin: 0; font-size: 28px;">Bem-vindo, {display_name}! 🎉</h1>
    </div>
    <div style="background: #1a1a2e; border-radius: 16px; padding: 32px; border: 1px solid rgba(196,181,253,0.1);">
      <p style="color: #a8a4c8; line-height: 1.6;">
        Sua conta Sentimenta está pronta. Conecte seu Instagram ou YouTube e descubra o que 
        seu público realmente pensa — em minutos.
      </p>
      <a href="{APP_URL}/connect" 
         style="display: inline-block; background: linear-gradient(135deg, #C4B5FD, #67E8F9); 
                color: #0f0e17; padding: 12px 24px; border-radius: 8px; 
                text-decoration: none; font-weight: 600; margin-top: 16px;">
        Conectar meu perfil →
      </a>
      <hr style="border: 1px solid rgba(196,181,253,0.1); margin: 24px 0;">
      <p style="color: #504e6e; font-size: 13px;">
        Dúvidas? Responda este email ou acesse nosso suporte.
      </p>
    </div>
  </div>
</body>
</html>
            """,
        })
        logger.info(f"Welcome email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send welcome email to {email}: {e}")
        return False


def send_analysis_ready_email(
    email: str,
    name: Optional[str],
    username: str,
    platform: str = "instagram",
    score: Optional[float] = None,
) -> bool:
    """
    Send notification when pipeline analysis is complete.
    Called in: pipeline_tasks.task_full_pipeline() on success
    """
    resend = _get_resend()
    if not resend:
        return False

    display_name = name or "criador"
    score_text = f"Score geral: <strong>{score:.1f}/10</strong>" if score else ""
    platform_emoji = "📸" if platform == "instagram" else "▶️"

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": email,
            "subject": f"Análise do @{username} está pronta! {platform_emoji}",
            "html": f"""
<!DOCTYPE html>
<html>
<body style="font-family: 'Inter', sans-serif; background: #0f0e17; color: #fffffe; padding: 32px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #C4B5FD, #67E8F9); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <h1 style="color: #0f0e17; margin: 0; font-size: 24px;">
        {platform_emoji} Análise pronta, {display_name}!
      </h1>
    </div>
    <div style="background: #1a1a2e; border-radius: 16px; padding: 32px; border: 1px solid rgba(196,181,253,0.1);">
      <p style="color: #a8a4c8; line-height: 1.6;">
        A análise do perfil <strong>@{username}</strong> foi concluída. 
        Os insights sobre o que seu público pensa estão prontos.
      </p>
      {f'<p style="color: #C4B5FD; font-size: 18px;">{score_text}</p>' if score_text else ''}
      <a href="{APP_URL}/dashboard"
         style="display: inline-block; background: linear-gradient(135deg, #C4B5FD, #67E8F9);
                color: #0f0e17; padding: 12px 24px; border-radius: 8px;
                text-decoration: none; font-weight: 600; margin-top: 16px;">
        Ver análise completa →
      </a>
    </div>
  </div>
</body>
</html>
            """,
        })
        logger.info(f"Analysis ready email sent to {email} for @{username}")
        return True
    except Exception as e:
        logger.error(f"Failed to send analysis email to {email}: {e}")
        return False


def send_plan_upgrade_email(email: str, name: Optional[str], plan: str) -> bool:
    """
    Send confirmation email after plan upgrade via Stripe.
    Called in: billing webhook handler
    """
    resend = _get_resend()
    if not resend:
        return False

    plan_names = {"creator": "Creator", "pro": "Pro", "agency": "Agency"}
    plan_display = plan_names.get(plan, plan.capitalize())
    display_name = name or "criador"

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": email,
            "subject": f"Plano {plan_display} ativado! 🚀",
            "html": f"""
<!DOCTYPE html>
<html>
<body style="font-family: 'Inter', sans-serif; background: #0f0e17; color: #fffffe; padding: 32px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #C4B5FD, #67E8F9); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <h1 style="color: #0f0e17; margin: 0;">🚀 Plano {plan_display} ativo!</h1>
    </div>
    <div style="background: #1a1a2e; border-radius: 16px; padding: 32px; border: 1px solid rgba(196,181,253,0.1);">
      <p style="color: #a8a4c8; line-height: 1.6;">
        Obrigado {display_name}! Seu plano <strong>{plan_display}</strong> está ativo.
        Agora você tem acesso a todos os recursos do plano — mais conexões, mais análises e mais insights.
      </p>
      <a href="{APP_URL}/dashboard"
         style="display: inline-block; background: linear-gradient(135deg, #C4B5FD, #67E8F9);
                color: #0f0e17; padding: 12px 24px; border-radius: 8px;
                text-decoration: none; font-weight: 600; margin-top: 16px;">
        Ir para o dashboard →
      </a>
      <p style="color: #504e6e; font-size: 13px; margin-top: 24px;">
        Para gerenciar ou cancelar sua assinatura, acesse as configurações da sua conta.
      </p>
    </div>
  </div>
</body>
</html>
            """,
        })
        logger.info(f"Plan upgrade email sent to {email} — plan: {plan}")
        return True
    except Exception as e:
        logger.error(f"Failed to send upgrade email to {email}: {e}")
        return False
