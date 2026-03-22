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


def _email_wrapper(title_html: str, body_html: str) -> str:
    """Wrap email content in a consistent, light-themed branded template."""
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Inter', Arial, sans-serif; background: #f4f2f7; color: #1a1a2e; margin: 0; padding: 32px 16px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); border-radius: 16px 16px 0 0; padding: 32px;">
      {title_html}
    </div>
    <div style="background: #ffffff; border-radius: 0 0 16px 16px; padding: 32px; border: 1px solid #e5e1ec; border-top: none;">
      {body_html}
    </div>
    <p style="text-align: center; color: #9a95a8; font-size: 12px; margin-top: 24px;">
      Sentimenta — Inteligência de sentimento para criadores
    </p>
  </div>
</body>
</html>
"""


def _btn(href: str, label: str) -> str:
    return f"""<a href="{href}"
       style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9);
              color: #ffffff; padding: 14px 28px; border-radius: 8px;
              text-decoration: none; font-weight: 600; margin-top: 16px; font-size: 15px;">
      {label}
    </a>"""


def send_welcome_email(email: str, name: Optional[str] = None) -> bool:
    """
    Send welcome email after registration.
    Called in: auth_service.register_user()
    """
    resend = _get_resend()
    if not resend:
        return False

    display_name = name or "criador"

    html = _email_wrapper(
        f'<h1 style="color: #ffffff; margin: 0; font-size: 28px;">Bem-vindo, {display_name}! 🎉</h1>',
        f"""
      <p style="color: #3d3852; line-height: 1.7; font-size: 15px;">
        Sua conta Sentimenta está pronta. Conecte seu Instagram ou YouTube e descubra o que
        seu público realmente pensa — em minutos.
      </p>
      {_btn(f"{APP_URL}/connect", "Conectar meu perfil →")}
      <hr style="border: 1px solid #e5e1ec; margin: 24px 0;">
      <p style="color: #9a95a8; font-size: 13px;">
        Dúvidas? Responda este email ou acesse nosso suporte.
      </p>
        """
    )

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": email,
            "subject": "Bem-vindo à Sentimenta 👋",
            "html": html,
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

    html = _email_wrapper(
        f'<h1 style="color: #ffffff; margin: 0; font-size: 24px;">{platform_emoji} Análise pronta, {display_name}!</h1>',
        f"""
      <p style="color: #3d3852; line-height: 1.7; font-size: 15px;">
        A análise do perfil <strong>@{username}</strong> foi concluída.
        Os insights sobre o que seu público pensa estão prontos.
      </p>
      {f'<p style="color: #7c3aed; font-size: 18px; font-weight: 600;">{score_text}</p>' if score_text else ''}
      {_btn(f"{APP_URL}/dashboard", "Ver análise completa →")}
        """
    )

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": email,
            "subject": f"Análise do @{username} está pronta! {platform_emoji}",
            "html": html,
        })
        logger.info(f"Analysis ready email sent to {email} for @{username}")
        return True
    except Exception as e:
        logger.error(f"Failed to send analysis email to {email}: {e}")
        return False


def send_verification_email(email: str, name: Optional[str], verification_url: str) -> bool:
    """
    Send email verification link after registration.
    Called in: auth router (register + send-verification endpoints)
    """
    resend = _get_resend()
    if not resend:
        return False

    display_name = name or "criador"

    html = _email_wrapper(
        '<h1 style="color: #ffffff; margin: 0; font-size: 24px;">Confirme seu email</h1>',
        f"""
      <p style="color: #3d3852; line-height: 1.7; font-size: 15px;">
        Oi {display_name}, precisamos confirmar que este email pertence a você
        para que possa usar a plataforma Sentimenta.
      </p>
      <p style="color: #3d3852; line-height: 1.7; font-size: 15px;">
        Clique no botão abaixo para verificar seu email. O link expira em <strong>24 horas</strong>.
      </p>
      {_btn(verification_url, "Confirmar meu email →")}
      <hr style="border: 1px solid #e5e1ec; margin: 24px 0;">
      <p style="color: #9a95a8; font-size: 13px;">
        Se você não criou uma conta na Sentimenta, ignore este email.
      </p>
        """
    )

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": email,
            "subject": "Confirme seu email — Sentimenta",
            "html": html,
        })
        logger.info(f"Verification email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {e}")
        return False


def send_password_reset_email(email: str, name: Optional[str], reset_url: str) -> bool:
    """Send password reset link. Token expires in 1 hour."""
    resend = _get_resend()
    if not resend:
        return False

    display_name = name or "criador"

    html = _email_wrapper(
        '<h1 style="color: #ffffff; margin: 0; font-size: 24px;">Redefinir senha</h1>',
        f"""
      <p style="color: #3d3852; line-height: 1.7; font-size: 15px;">
        Oi {display_name}, recebemos um pedido para redefinir a senha da sua conta Sentimenta.
      </p>
      <p style="color: #3d3852; line-height: 1.7; font-size: 15px;">
        Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.
      </p>
      {_btn(reset_url, "Redefinir minha senha")}
      <hr style="border: 1px solid #e5e1ec; margin: 24px 0;">
      <p style="color: #9a95a8; font-size: 13px;">
        Se você não solicitou a redefinição, ignore este email. Sua senha continuará a mesma.
      </p>
        """
    )

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": email,
            "subject": "Redefinir senha — Sentimenta",
            "html": html,
        })
        logger.info(f"Password reset email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {e}")
        return False


def send_support_contact_email(name: str, email: str, subject: str, message: str) -> bool:
    """Send support contact form to SUPPORT_EMAIL with reply-to set to the user."""
    resend = _get_resend()
    if not resend:
        return False

    support_email = os.getenv("SUPPORT_EMAIL", "vinicius.anjos@mazylabs.com")

    html = _email_wrapper(
        '<h1 style="color: #ffffff; margin: 0; font-size: 24px;">Nova mensagem de suporte</h1>',
        f"""
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #9a95a8; font-size: 13px; padding: 8px 0; vertical-align: top; width: 80px;">Nome:</td>
          <td style="color: #3d3852; font-size: 15px; padding: 8px 0; font-weight: 500;">{name}</td>
        </tr>
        <tr>
          <td style="color: #9a95a8; font-size: 13px; padding: 8px 0; vertical-align: top;">Email:</td>
          <td style="color: #3d3852; font-size: 15px; padding: 8px 0;">{email}</td>
        </tr>
        <tr>
          <td style="color: #9a95a8; font-size: 13px; padding: 8px 0; vertical-align: top;">Assunto:</td>
          <td style="color: #3d3852; font-size: 15px; padding: 8px 0;">{subject}</td>
        </tr>
      </table>
      <hr style="border: 1px solid #e5e1ec; margin: 16px 0;">
      <p style="color: #3d3852; line-height: 1.7; font-size: 15px; white-space: pre-wrap;">{message}</p>
      <hr style="border: 1px solid #e5e1ec; margin: 16px 0;">
      <p style="color: #9a95a8; font-size: 12px;">
        Responda diretamente este email para falar com {name} ({email}).
      </p>
        """
    )

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": support_email,
            "reply_to": email,
            "subject": f"[Suporte Sentimenta] {subject}",
            "html": html,
        })
        logger.info(f"Support contact email sent from {email} — subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send support contact email from {email}: {e}")
        return False


def send_plan_upgrade_email(email: str, name: Optional[str], plan: str) -> bool:
    """
    Send confirmation email after plan upgrade via Stripe.
    Called in: billing webhook handler
    """
    resend = _get_resend()
    if not resend:
        return False

    plan_names = {"starter": "Starter", "pro": "Pro", "business": "Business", "creator": "Starter", "agency": "Business"}
    plan_display = plan_names.get(plan, plan.capitalize())
    display_name = name or "criador"

    html = _email_wrapper(
        f'<h1 style="color: #ffffff; margin: 0; font-size: 24px;">🚀 Plano {plan_display} ativo!</h1>',
        f"""
      <p style="color: #3d3852; line-height: 1.7; font-size: 15px;">
        Obrigado {display_name}! Seu plano <strong>{plan_display}</strong> está ativo.
        Agora você tem acesso a todos os recursos do plano — mais conexões, mais análises e mais insights.
      </p>
      {_btn(f"{APP_URL}/dashboard", "Ir para o dashboard →")}
      <p style="color: #9a95a8; font-size: 13px; margin-top: 24px;">
        Para gerenciar ou cancelar sua assinatura, acesse as configurações da sua conta.
      </p>
        """
    )

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": email,
            "subject": f"Plano {plan_display} ativado! 🚀",
            "html": html,
        })
        logger.info(f"Plan upgrade email sent to {email} — plan: {plan}")
        return True
    except Exception as e:
        logger.error(f"Failed to send upgrade email to {email}: {e}")
        return False
