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

# ─── Platform Cost Model (USD per item) ─────────────────────────────
# Three layers of cost (ADR-013):
#   observed_cost  — real cost from Apify API per run. Used for auditoria.
#   estimated_cost — pre-run estimate based on historical averages. Shown to user.
#   guardrail_cost — conservative p95/worst-case. Used for budget protection & pre-auth.
#
# Verified from 2,057 Apify runs (Apr/2026) via API sampling.
# guardrail uses ~2x estimated as safety margin.

PLATFORM_COSTS_USD = {
    "instagram": {
        "estimated": {"per_post": 0.00072, "per_comment": 0.0005, "per_profile": 0.0023},
        "guardrail": {"per_post": 0.0023, "per_comment": 0.001, "per_profile": 0.0046},
    },
    "tiktok": {
        "estimated": {"per_post": 0.003, "per_comment": 0.0009, "per_profile": 0.001},
        "guardrail": {"per_post": 0.006, "per_comment": 0.002, "per_profile": 0.002},
    },
    "twitter": {
        "estimated": {"per_post": 0.0011, "per_comment": 0.0005, "per_profile": 0.001},
        "guardrail": {"per_post": 0.0022, "per_comment": 0.001, "per_profile": 0.002},
    },
    "youtube": {
        "estimated": {"per_post": 0.0, "per_comment": 0.0, "per_profile": 0.0},
        "guardrail": {"per_post": 0.0, "per_comment": 0.0, "per_profile": 0.0},
    },
}

# LLM cost per comment (Gemini 2.0 Flash) — negligible but tracked
LLM_COST_PER_COMMENT_USD = 0.000064  # ~$0.064/1000 comments


def get_platform_costs(platform: str, layer: str = "estimated") -> dict:
    """Get cost dict for a platform. layer: 'estimated' or 'guardrail'."""
    return PLATFORM_COSTS_USD.get(platform, PLATFORM_COSTS_USD["youtube"]).get(
        layer, PLATFORM_COSTS_USD["youtube"]["estimated"]
    )

# ─── Plan Configuration — Strategy 2: Credits-based (ADR-011) ───────
# Modelo: plano base + créditos mensais (1 crédito = 1 comentário).
# Demographics Pro+ only: 5 créditos por perfil demográfico.
# Gap de mercado: entre mLabs (R$70, sem sentiment) e Buzzmonitor (R$1.590).

PLAN_LIMITS = {
    "free": {
        "max_connections": 1,
        "credits_per_month": 200,
        "comments_included_per_month": 200,
        "overage_price_per_comment": 0.0,  # Blocked — must upgrade
        "overage_allowed": False,
        "sync_frequency": "weekly",          # auto sync semanal
        "historic_days": 30,               # First run: max days back
        "max_posts_per_sync": 5,
        "max_comments_per_post": 500,
        "syncs_per_month": 4,              # 4 syncs/month (cap enforced by 200 credits)
        "apify_budget_brl": 15.0,
        "health_report": True,
        "pdf_export": False,
        "comparison": True,
        "api_access": False,
        "demographics": False,
    },
    "starter": {
        "max_connections": 3,
        "credits_per_month": 5_000,
        "comments_included_per_month": 5_000,
        "overage_price_per_comment": 0.04,
        "overage_allowed": True,
        "sync_frequency": "weekly",
        "historic_days": 90,
        "max_posts_per_sync": 30,
        "max_comments_per_post": 1000,
        "syncs_per_month": 8,
        "apify_budget_brl": 200.0,
        "health_report": True,
        "pdf_export": False,
        "comparison": False,
        "api_access": False,
        "demographics": False,
    },
    "pro": {
        "max_connections": 7,
        "credits_per_month": 20_000,
        "comments_included_per_month": 20_000,
        "overage_price_per_comment": 0.035,
        "overage_allowed": True,
        "sync_frequency": "daily",
        "historic_days": 180,
        "max_posts_per_sync": 60,
        "max_comments_per_post": 2000,
        "syncs_per_month": 30,
        "apify_budget_brl": 800.0,
        "health_report": True,
        "pdf_export": True,
        "comparison": True,
        "api_access": False,
        "demographics": True,
    },
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

# Exchange rate for BRL conversions
USD_TO_BRL = 6.0  # Updated Mar/2026

# Legacy constant — kept for backward compatibility in get_apify_spend_this_month().
# Uses guardrail layer (conservative) for budget protection.
# Real cost is much lower (~R$0.003/comment), this is intentionally conservative.
APIFY_COST_PER_COMMENT_BRL = 0.006  # R$0.006/comment — guardrail (was 0.020, adjusted Apr/2026)


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
        if user.plan == "free":
            raise PlanLimitError(
                "Seus créditos acabaram. Faça upgrade para continuar analisando.",
                code="no_credits",
            )
        else:
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

    max_posts = limits["max_posts_per_sync"]
    max_comments_per_post = limits["max_comments_per_post"]

    # ADR-013: Cap collection to what user can actually analyze (credits available).
    # This prevents wasting Apify budget on comments that won't be analyzed.
    collection_cap = total_credits  # 1 credit = 1 comment analyzed
    max_total_comments = max_posts * max_comments_per_post
    if collection_cap < max_total_comments:
        # Reduce max_comments_per_post so total doesn't exceed available credits
        max_comments_per_post = max(1, collection_cap // max(max_posts, 1))

    result = {
        "max_posts": max_posts,
        "max_comments_per_post": max_comments_per_post,
        "collection_cap": collection_cap,
        "credits_available": total_credits,
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


def estimate_sync_cost_brl(
    num_posts: int,
    avg_comments_per_post: int,
    platform: str = "instagram",
    layer: str = "estimated",
    include_demographics: bool = False,
    avg_unique_authors_ratio: float = 0.6,
    is_first_run: bool = False,
) -> dict:
    """Estimate the cost of a sync in BRL before running it.

    D+0 (first run) is typically 5-10x more expensive because it fetches
    historic posts. Recurring syncs only check last ~5 posts.

    Returns dict with estimated_cost_brl, guardrail_cost_brl, and breakdown.
    """
    costs_est = get_platform_costs(platform, "estimated")
    costs_guard = get_platform_costs(platform, "guardrail")
    total_comments = num_posts * avg_comments_per_post

    # D+0 multiplier: first run collects historic data (more posts, more comments)
    d0_multiplier = 5.0 if is_first_run else 1.0

    def _calc(costs: dict) -> float:
        apify = (
            num_posts * costs.get("per_post", 0)
            + total_comments * costs.get("per_comment", 0)
        ) * d0_multiplier
        llm = total_comments * LLM_COST_PER_COMMENT_USD * d0_multiplier
        demographics = 0.0
        if include_demographics:
            profiles = int(total_comments * avg_unique_authors_ratio * d0_multiplier)
            demographics = profiles * costs.get("per_profile", 0)
        return round((apify + llm + demographics) * USD_TO_BRL, 2)

    return {
        "estimated_cost_brl": _calc(costs_est),
        "guardrail_cost_brl": _calc(costs_guard),
        "total_comments": int(total_comments * d0_multiplier),
        "platform": platform,
        "is_first_run": is_first_run,
    }


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
    costs = get_platform_costs(platform, "estimated")
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
