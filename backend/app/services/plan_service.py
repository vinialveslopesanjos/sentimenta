"""
Plan Limits & Usage Enforcement

Centralized plan configuration and usage-checking service.
Every sync trigger must pass through `enforce_plan_limits()` before
starting the Apify/instaloader pipeline.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.social_connection import SocialConnection
from app.models.pipeline_run import PipelineRun
from app.models.demographics import UsageLog

logger = logging.getLogger(__name__)

# ─── Platform Cost Estimates (USD per operation) ────────────────────
# Verified from 1,575 Apify runs (Mar/2026) — real pay-per-result pricing
PLATFORM_COSTS_USD = {
    "instagram": {"per_post": 0.0023, "per_comment": 0.0005, "per_profile": 0.0023},
    "tiktok": {"per_post": 0.003023, "per_comment": 0.001, "per_profile": 0.001},
    "twitter": {"per_post": 0.001128, "per_comment": 0.0004, "per_profile": 0.001},
    "youtube": {"per_post": 0.0, "per_comment": 0.0, "per_profile": 0.0},
}

# ─── Plan Configuration — Pricing Jul/2026 ──────────────────────────
# Modelo: trial 14d com cartão → Starter R$197 → Pro R$497 → Enterprise
# sob consulta. 1 crédito = 1 comentário; demographics = 5 créditos/perfil.
# "free" = estado sem assinatura: dados visíveis, sync bloqueado.
# Ver docs/prioridade/PRICING_2026-07.md.

PLAN_LIMITS = {
    "free": {
        "max_connections": 1,
        "credits_per_month": 0,
        "comments_included_per_month": 0,
        "overage_price_per_comment": 0.0,  # Blocked — must start trial
        "overage_allowed": False,
        "sync_frequency": "weekly",
        "historic_days": 30,
        "max_posts_per_sync": 5,
        "max_comments_per_post": 500,
        "syncs_per_month": 0,              # sem assinatura = sem sync
        "apify_budget_brl": 0.0,
        "health_report": True,
        "pdf_export": False,
        "comparison": True,
        "api_access": False,
        "demographics": False,
    },
    "starter": {
        "max_connections": 3,
        "credits_per_month": 10_000,
        "comments_included_per_month": 10_000,
        "overage_price_per_comment": 0.05,
        "overage_allowed": True,
        "sync_frequency": "weekly",
        "historic_days": 90,
        "max_posts_per_sync": 30,
        "max_comments_per_post": 1000,
        "syncs_per_month": 8,
        "apify_budget_brl": 400.0,
        "health_report": True,
        "pdf_export": False,
        "comparison": False,
        "api_access": False,
        "demographics": False,
    },
    "pro": {
        "max_connections": 10,
        "credits_per_month": 40_000,
        "comments_included_per_month": 40_000,
        "overage_price_per_comment": 0.04,
        "overage_allowed": True,
        "sync_frequency": "daily",
        "historic_days": 365,
        "max_posts_per_sync": 60,
        "max_comments_per_post": 2000,
        "syncs_per_month": 30,
        "apify_budget_brl": 1_600.0,
        "health_report": True,
        "pdf_export": True,
        "comparison": True,
        "api_access": True,
        "demographics": True,
    },
    # Legado: fora de linha desde jul/2026 (assinantes existentes mantêm)
    "business": {
        "max_connections": 20,
        "credits_per_month": 40_000,
        "comments_included_per_month": 40_000,
        "overage_price_per_comment": 0.03,
        "overage_allowed": True,
        "sync_frequency": "daily",
        "historic_days": 365,
        "max_posts_per_sync": 120,
        "max_comments_per_post": 5000,
        "syncs_per_month": 60,
        "apify_budget_brl": 3000.0,
        "health_report": True,
        "pdf_export": True,
        "comparison": True,
        "api_access": True,
        "demographics": True,
    },
    "enterprise": {
        "max_connections": 999,
        "credits_per_month": 999_999,
        "comments_included_per_month": 999_999,
        "overage_price_per_comment": 0.0,  # Negotiated
        "overage_allowed": True,
        "sync_frequency": "daily",
        "historic_days": 9999,
        "max_posts_per_sync": 500,
        "max_comments_per_post": 10000,
        "syncs_per_month": 999,
        "apify_budget_brl": 99999.0,
        "health_report": True,
        "pdf_export": True,
        "comparison": True,
        "api_access": True,
        "demographics": True,
    },
    "admin": {
        "max_connections": 100,
        "credits_per_month": 999_999,
        "comments_included_per_month": 999_999,
        "overage_price_per_comment": 0.0,
        "overage_allowed": True,
        "sync_frequency": "daily",
        "historic_days": 9999,
        "max_posts_per_sync": 999999,
        "max_comments_per_post": 999999,
        "syncs_per_month": 999999,
        "apify_budget_brl": 999999.0,
        "health_report": True,
        "pdf_export": True,
        "comparison": True,
        "api_access": True,
        "demographics": True,
    },
}

# Legacy plan name mappings (for existing users)
LEGACY_PLAN_MAP = {
    "creator": "starter",
    "agency": "business",
}

# Apify cost reference (verified Mar/2026 from 1,575 real runs):
# Instagram comments scraper: $3.27/1000 comments (pay-per-result)
# Instagram profile scraper: $1.41/1000 profiles (demographics)
# Full cost incl. demographics (~58% unique authors): ~$4.11/1000 comments
# At BRL ~6.0/USD → R$24.68/1000 comments (first run) / R$21.15/1000 (ongoing, 30% new)
# IMPORTANT: actual monthly cost is much lower because daily sync only checks 5 recent posts
APIFY_COST_PER_COMMENT_BRL = 0.020  # R$0.02/comment — blended estimate (first + ongoing)
USD_TO_BRL = 6.0  # Updated Mar/2026


def get_plan_limits(plan: str) -> dict:
    """Get limits for a plan, mapping legacy names and defaulting to free."""
    resolved = LEGACY_PLAN_MAP.get(plan, plan)
    return PLAN_LIMITS.get(resolved, PLAN_LIMITS["free"])


def get_billing_period_start() -> datetime:
    """First day of current month (UTC)."""
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def count_syncs_this_month(db: Session, user_id) -> int:
    """Count how many pipeline runs the user triggered this billing period."""
    period_start = get_billing_period_start()
    recent_running_cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
    return (
        db.query(func.count(PipelineRun.id))
        .filter(
            PipelineRun.user_id == user_id,
            PipelineRun.started_at >= period_start,
            (
                PipelineRun.status.in_(["completed", "partial"])
                | (
                    (PipelineRun.status == "running")
                    & (PipelineRun.started_at >= recent_running_cutoff)
                )
            ),
        )
        .scalar()
        or 0
    )


def count_connections(db: Session, user_id, platform: str = None) -> int:
    """Count active connections for a user, filtering by platform if provided."""
    query = db.query(func.count(SocialConnection.id)).filter(
        SocialConnection.user_id == user_id,
        SocialConnection.status == "active",
    )
    if platform:
        query = query.filter(SocialConnection.platform == platform)
    return query.scalar() or 0


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


def get_comments_this_month(db: Session, user_id) -> int:
    """Count total comments fetched this billing period."""
    period_start = get_billing_period_start()
    total = (
        db.query(func.sum(PipelineRun.comments_fetched))
        .filter(
            PipelineRun.user_id == user_id,
            PipelineRun.started_at >= period_start,
        )
        .scalar()
        or 0
    )
    return int(total)


def calculate_overage(db: Session, user: User) -> dict:
    """Calculate overage comments and cost for current billing period."""
    limits = get_plan_limits(user.plan)
    comments_used = get_comments_this_month(db, user.id)
    included = limits["comments_included_per_month"]
    overage_comments = max(0, comments_used - included)
    overage_price = limits.get("overage_price_per_comment", 0.0)
    overage_cost = round(overage_comments * overage_price, 2)
    return {
        "comments_used": comments_used,
        "comments_included": included,
        "overage_comments": overage_comments,
        "overage_price_per_comment": overage_price,
        "overage_cost_brl": overage_cost,
        "overage_allowed": limits.get("overage_allowed", False),
    }


def get_user_usage(db: Session, user: User) -> dict:
    """Get full usage summary for a user, including credit balance."""
    from app.services.credit_service import get_balance

    limits = get_plan_limits(user.plan)
    period_start = get_billing_period_start()
    now = datetime.now(timezone.utc)
    if now.month == 12:
        period_end = now.replace(year=now.year + 1, month=1, day=1)
    else:
        period_end = now.replace(month=now.month + 1, day=1)

    overage = calculate_overage(db, user)
    credits = get_balance(db, user.id)

    return {
        "syncs_used_this_month": count_syncs_this_month(db, user.id),
        "syncs_limit": limits["syncs_per_month"],
        "connections_used": count_connections(db, user.id),
        "connections_limit": limits["max_connections"],
        "comments_used_this_month": overage["comments_used"],
        "comments_included": overage["comments_included"],
        "overage_comments": overage["overage_comments"],
        "overage_cost_brl": overage["overage_cost_brl"],
        "overage_price_per_comment": overage["overage_price_per_comment"],
        "overage_allowed": overage["overage_allowed"],
        # Credit system (ADR-011)
        "credits": credits,
        "credits_per_month": limits.get("credits_per_month", 0),
        # Legacy fields (backward compat)
        "apify_credits_used_brl": round(get_apify_spend_this_month(db, user.id), 2),
        "apify_credits_limit_brl": limits.get("apify_budget_brl", 0),
        "billing_period_start": period_start.isoformat(),
        "billing_period_end": period_end.isoformat(),
    }


class PlanLimitError(Exception):
    """Raised when a user exceeds their plan limits."""

    def __init__(self, message: str, code: str = "plan_limit_exceeded"):
        self.message = message
        self.code = code
        super().__init__(self.message)


def enforce_connection_limit(db: Session, user: User, platform: str) -> None:
    """Check if user can add another connection, with max 1 per platform."""
    limits = get_plan_limits(user.plan)
    current_total = count_connections(db, user.id)
    if current_total >= limits["max_connections"]:
        raise PlanLimitError(
            f"Seu plano permite no máximo {limits['max_connections']} conexões no total.",
            code="max_connections",
        )
    
    current_platform = count_connections(db, user.id, platform=platform)
    if current_platform >= 1:
        raise PlanLimitError(
            f"Você já conectou 1 perfil do {platform.capitalize()}. Atualmente, o limite é de 1 conta por plataforma.",
            code="max_connections_platform",
        )


def enforce_sync_limits(db: Session, user: User) -> dict:
    """
    Check if user can trigger a sync. Returns the effective limits
    (max_posts, max_comments) that should be applied to this sync.

    Uses credit system as primary enforcement (ADR-011).
    Raises PlanLimitError if any limit is exceeded.
    """
    from app.services.credit_service import get_or_create_balance

    limits = get_plan_limits(user.plan)

    # 0. Sem assinatura ativa: bloqueia antes de qualquer contagem
    if user.plan == "free":
        raise PlanLimitError(
            "Você ainda não tem uma assinatura ativa. Inicie seu trial "
            "gratuito de 14 dias para analisar comentários.",
            code="no_subscription",
        )

    # 1. Check syncs per month
    syncs_used = count_syncs_this_month(db, user.id)
    if syncs_used >= limits["syncs_per_month"]:
        raise PlanLimitError(
            f"Seu plano ({user.plan}) permite {limits['syncs_per_month']} "
            f"análise(s) por mês. Você já usou {syncs_used}. "
            f"Faça upgrade ou aguarde o próximo ciclo.",
            code="max_syncs",
        )

    # 2. Check credit balance (primary enforcement — ADR-011)
    bal = get_or_create_balance(db, user.id)
    total_credits = bal.plan_credits + bal.pack_credits

    if total_credits <= 0:
        raise PlanLimitError(
            "Seus créditos acabaram. Compre um pacote de créditos extras para continuar.",
            code="no_credits",
        )

    # 3. Check Apify budget (safety net)
    apify_spent = get_apify_spend_this_month(db, user.id)
    if apify_spent >= limits.get("apify_budget_brl", 999999):
        raise PlanLimitError(
            f"Seu orçamento de coleta deste mês foi atingido "
            f"(R${apify_spent:.2f} / R${limits['apify_budget_brl']:.2f}). "
            f"Faça upgrade para continuar analisando.",
            code="apify_budget",
        )

    logger.info(
        f"User {user.id} ({user.plan}): sync {syncs_used + 1}/{limits['syncs_per_month']}, "
        f"credits {total_credits:,} (plan={bal.plan_credits:,} pack={bal.pack_credits:,})"
    )

    result = {
        "max_posts": limits["max_posts_per_sync"],
        "max_comments_per_post": limits["max_comments_per_post"],
    }

    return result


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


# ─── Usage Logging & Budget Tracking (Fase 4 — Multi-Platform) ─────

def log_usage(
    db: Session,
    user_id,
    connection_id,
    platform: str,
    operation: str,
    posts_count: int = 0,
    comments_count: int = 0,
    profiles_count: int = 0,
) -> float:
    """Registra uso e calcula custo estimado por plataforma.

    Returns the estimated cost in USD for this operation.
    """
    costs = PLATFORM_COSTS_USD.get(platform, {})
    estimated_cost = (
        posts_count * costs.get("per_post", 0)
        + comments_count * costs.get("per_comment", 0)
        + profiles_count * costs.get("per_profile", 0)
    )
    entry = UsageLog(
        user_id=user_id,
        connection_id=connection_id,
        platform=platform,
        operation=operation,
        posts_count=posts_count,
        comments_count=comments_count,
        profiles_count=profiles_count,
        estimated_cost_usd=round(estimated_cost, 6),
    )
    db.add(entry)
    try:
        db.commit()
    except Exception as exc:
        logger.error("log_usage commit failed: %s", exc)
        db.rollback()
    logger.info(
        "Usage logged: user=%s platform=%s op=%s posts=%d comments=%d profiles=%d cost=$%.4f",
        user_id, platform, operation, posts_count, comments_count, profiles_count, estimated_cost,
    )
    return estimated_cost


def get_user_monthly_usage(db: Session, user_id) -> dict:
    """Retorna uso do mês atual agrupado por plataforma.

    Returns:
        {
            "total_posts": int,
            "total_comments": int,
            "total_profiles": int,
            "total_cost_usd": float,
            "by_platform": {
                "instagram": {"posts": ..., "comments": ..., "profiles": ..., "cost_usd": ...},
                ...
            }
        }
    """
    period_start = get_billing_period_start()
    rows = (
        db.query(
            UsageLog.platform,
            func.sum(UsageLog.posts_count).label("posts"),
            func.sum(UsageLog.comments_count).label("comments"),
            func.sum(UsageLog.profiles_count).label("profiles"),
            func.sum(UsageLog.estimated_cost_usd).label("cost"),
        )
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.created_at >= period_start,
        )
        .group_by(UsageLog.platform)
        .all()
    )

    by_platform = {}
    total_posts = 0
    total_comments = 0
    total_profiles = 0
    total_cost = 0.0

    for row in rows:
        posts = int(row.posts or 0)
        comments = int(row.comments or 0)
        profiles = int(row.profiles or 0)
        cost = float(row.cost or 0.0)
        by_platform[row.platform] = {
            "posts": posts,
            "comments": comments,
            "profiles": profiles,
            "cost_usd": round(cost, 4),
        }
        total_posts += posts
        total_comments += comments
        total_profiles += profiles
        total_cost += cost

    return {
        "total_posts": total_posts,
        "total_comments": total_comments,
        "total_profiles": total_profiles,
        "total_cost_usd": round(total_cost, 4),
        "by_platform": by_platform,
        "billing_period_start": period_start.isoformat(),
    }


def can_user_sync(db: Session, user_id, platform: str) -> tuple:
    """Verifica se o usuário pode fazer sync baseado no plano.

    Returns:
        (True, "") if allowed
        (False, "reason") if not allowed

    NOTE: Fase 4 — apenas warning, não bloqueia. O blocking vem depois.
    """
    user = db.get(User, user_id)
    if not user:
        return False, "Usuário não encontrado"

    limits = get_plan_limits(user.plan)

    # Check syncs per month
    syncs_used = count_syncs_this_month(db, user.id)
    if syncs_used >= limits["syncs_per_month"]:
        msg = (
            f"Limite de syncs atingido ({syncs_used}/{limits['syncs_per_month']}). "
            f"Plano: {user.plan}"
        )
        logger.warning("can_user_sync: %s (user=%s, platform=%s)", msg, user_id, platform)
        return False, msg

    # Check comments quota
    comments_used = get_comments_this_month(db, user.id)
    included = limits["comments_included_per_month"]
    if comments_used >= included and not limits.get("overage_allowed", False):
        msg = (
            f"Cota de comentários atingida ({comments_used:,}/{included:,}). "
            f"Plano: {user.plan}"
        )
        logger.warning("can_user_sync: %s (user=%s, platform=%s)", msg, user_id, platform)
        return False, msg

    # Check monthly platform cost (warning only, not blocking)
    usage = get_user_monthly_usage(db, user_id)
    platform_cost = usage["by_platform"].get(platform, {}).get("cost_usd", 0.0)
    total_cost = usage["total_cost_usd"]
    apify_budget_usd = limits.get("apify_budget_brl", 0) / USD_TO_BRL

    if total_cost > apify_budget_usd * 0.8:
        logger.warning(
            "can_user_sync WARNING: user=%s approaching budget (cost=$%.2f / budget=$%.2f, platform=%s cost=$%.2f)",
            user_id, total_cost, apify_budget_usd, platform, platform_cost,
        )

    return True, ""
