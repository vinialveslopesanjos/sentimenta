"""
Plan Limits & Usage Enforcement

Centralized plan configuration and usage-checking service.
Every sync trigger must pass through `enforce_plan_limits()` before
starting the Apify/instaloader pipeline.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.social_connection import SocialConnection
from app.models.pipeline_run import PipelineRun

logger = logging.getLogger(__name__)

# ─── Plan Configuration (mirrors @sentimenta/types billing.ts) ─────

PLAN_LIMITS = {
    "free": {
        "max_connections": 1,
        "max_posts_per_sync": 5,
        "max_comments_per_post": 50,
        "syncs_per_month": 1,
        "apify_budget_brl": 10.0,
        "health_report": False,
        "pdf_export": False,
        "comparison": False,
    },
    "creator": {
        "max_connections": 3,
        "max_posts_per_sync": 20,
        "max_comments_per_post": 300,
        "syncs_per_month": 10,
        "apify_budget_brl": 80.0,
        "health_report": True,
        "pdf_export": False,
        "comparison": False,
    },
    "pro": {
        "max_connections": 10,
        "max_posts_per_sync": 50,
        "max_comments_per_post": 500,
        "syncs_per_month": 30,
        "apify_budget_brl": 250.0,
        "health_report": True,
        "pdf_export": True,
        "comparison": True,
    },
    "agency": {
        "max_connections": 30,
        "max_posts_per_sync": 100,
        "max_comments_per_post": 1000,
        "syncs_per_month": 100,
        "apify_budget_brl": 800.0,
        "health_report": True,
        "pdf_export": True,
        "comparison": True,
    },
}

# Apify cost reference: $2.30 per 1,000 comments
# At BRL ~5.0/USD → R$11.50 per 1,000 comments → R$0.0115 per comment
APIFY_COST_PER_COMMENT_BRL = 0.0115
USD_TO_BRL = 5.0  # Update periodically or fetch from API


def get_plan_limits(plan: str) -> dict:
    """Get limits for a plan, defaulting to free."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


def get_billing_period_start() -> datetime:
    """First day of current month (UTC)."""
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def count_syncs_this_month(db: Session, user_id) -> int:
    """Count how many pipeline runs the user triggered this billing period."""
    period_start = get_billing_period_start()
    return (
        db.query(func.count(PipelineRun.id))
        .filter(
            PipelineRun.user_id == user_id,
            PipelineRun.started_at >= period_start,
        )
        .scalar()
        or 0
    )


def count_connections(db: Session, user_id) -> int:
    """Count active connections for a user."""
    return (
        db.query(func.count(SocialConnection.id))
        .filter(
            SocialConnection.user_id == user_id,
            SocialConnection.status == "active",
        )
        .scalar()
        or 0
    )


def get_apify_spend_this_month(db: Session, user_id) -> float:
    """
    Sum up estimated Apify cost for the current billing period.
    Uses comments_fetched from pipeline_runs as proxy.
    """
    period_start = get_billing_period_start()
    total_comments = (
        db.query(func.sum(PipelineRun.comments_fetched))
        .filter(
            PipelineRun.user_id == user_id,
            PipelineRun.started_at >= period_start,
        )
        .scalar()
        or 0
    )
    return total_comments * APIFY_COST_PER_COMMENT_BRL


def get_user_usage(db: Session, user: User) -> dict:
    """Get full usage summary for a user (for /auth/me endpoint)."""
    limits = get_plan_limits(user.plan)
    period_start = get_billing_period_start()
    now = datetime.now(timezone.utc)
    # Billing period end = first day of next month
    if now.month == 12:
        period_end = now.replace(year=now.year + 1, month=1, day=1)
    else:
        period_end = now.replace(month=now.month + 1, day=1)

    return {
        "syncs_used_this_month": count_syncs_this_month(db, user.id),
        "syncs_limit": limits["syncs_per_month"],
        "connections_used": count_connections(db, user.id),
        "connections_limit": limits["max_connections"],
        "apify_credits_used_brl": round(get_apify_spend_this_month(db, user.id), 2),
        "apify_credits_limit_brl": limits["apify_budget_brl"],
        "billing_period_start": period_start.isoformat(),
        "billing_period_end": period_end.isoformat(),
    }


class PlanLimitError(Exception):
    """Raised when a user exceeds their plan limits."""

    def __init__(self, message: str, code: str = "plan_limit_exceeded"):
        self.message = message
        self.code = code
        super().__init__(self.message)


def enforce_connection_limit(db: Session, user: User) -> None:
    """Check if user can add another connection."""
    limits = get_plan_limits(user.plan)
    current = count_connections(db, user.id)
    if current >= limits["max_connections"]:
        raise PlanLimitError(
            f"Seu plano ({user.plan}) permite no máximo {limits['max_connections']} "
            f"conexão(ões). Você já tem {current}. Faça upgrade para adicionar mais.",
            code="max_connections",
        )


def enforce_sync_limits(db: Session, user: User) -> dict:
    """
    Check if user can trigger a sync. Returns the effective limits
    (max_posts, max_comments) that should be applied to this sync.

    Raises PlanLimitError if any limit is exceeded.
    """
    limits = get_plan_limits(user.plan)

    # 1. Check syncs per month
    syncs_used = count_syncs_this_month(db, user.id)
    if syncs_used >= limits["syncs_per_month"]:
        raise PlanLimitError(
            f"Seu plano ({user.plan}) permite {limits['syncs_per_month']} "
            f"análise(s) por mês. Você já usou {syncs_used}. "
            f"Faça upgrade ou aguarde o próximo ciclo.",
            code="max_syncs",
        )

    # 2. Check Apify budget
    apify_spent = get_apify_spend_this_month(db, user.id)
    if apify_spent >= limits["apify_budget_brl"]:
        raise PlanLimitError(
            f"Seu orçamento de coleta deste mês foi atingido "
            f"(R${apify_spent:.2f} / R${limits['apify_budget_brl']:.2f}). "
            f"Faça upgrade para continuar analisando.",
            code="apify_budget",
        )

    logger.info(
        f"User {user.id} ({user.plan}): sync {syncs_used + 1}/{limits['syncs_per_month']}, "
        f"Apify R${apify_spent:.2f}/{limits['apify_budget_brl']:.2f}"
    )

    return {
        "max_posts": limits["max_posts_per_sync"],
        "max_comments_per_post": limits["max_comments_per_post"],
    }


def enforce_feature_access(user: User, feature: str) -> None:
    """
    Check if user's plan has access to a specific feature.
    Features: 'health_report', 'pdf_export', 'comparison'
    """
    limits = get_plan_limits(user.plan)
    if not limits.get(feature, False):
        raise PlanLimitError(
            f"A funcionalidade '{feature}' não está disponível no plano {user.plan}. "
            f"Faça upgrade para acessar.",
            code=f"feature_{feature}",
        )


def estimate_sync_cost_brl(num_posts: int, avg_comments_per_post: int) -> float:
    """Estimate the cost of a sync in BRL before running it."""
    total_comments = num_posts * avg_comments_per_post
    apify_cost = total_comments * APIFY_COST_PER_COMMENT_BRL
    # Add ~5% for Gemini API cost
    gemini_cost = apify_cost * 0.05
    return round(apify_cost + gemini_cost, 2)
