"""
Billing & Usage Router

Endpoints for plan information, usage stats, and future Stripe integration.
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.plan_service import (
    PLAN_LIMITS,
    get_user_usage,
    estimate_sync_cost_brl,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

# Pricing display — mirrors @sentimenta/types billing.ts PLAN_PRICING
PLAN_PRICING = [
    {"slug": "free",    "name": "Grátis",  "price_brl": 0,   "description": "Teste com uma conexão e uma análise por mês."},
    {"slug": "creator", "name": "Creator", "price_brl": 67,  "description": "Para criadores que querem entender seu público."},
    {"slug": "pro",     "name": "Pro",     "price_brl": 167, "description": "Para marcas e profissionais.", "highlight": True},
    {"slug": "agency",  "name": "Agency",  "price_brl": 397, "description": "Para agências com múltiplos perfis."},
]


@router.get("/plans")
def get_plans():
    """
    List all available plans with their limits and pricing.
    """
    plans = []
    for pricing in PLAN_PRICING:
        slug = pricing["slug"]
        plans.append({
            **pricing,
            "limits": PLAN_LIMITS.get(slug, {}),
        })
    return {"plans": plans}


@router.get("/usage")
def get_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get current user's usage stats for the billing period.
    """
    usage = get_user_usage(db, current_user)
    return {
        "plan": current_user.plan,
        "usage": usage,
    }


@router.get("/estimate")
def estimate_cost(
    num_posts: int = 10,
    avg_comments: int = 50,
):
    """
    Estimate the cost of a sync before running it.
    """
    cost = estimate_sync_cost_brl(num_posts, avg_comments)
    return {
        "num_posts": num_posts,
        "avg_comments_per_post": avg_comments,
        "total_comments": num_posts * avg_comments,
        "estimated_cost_brl": cost,
    }
