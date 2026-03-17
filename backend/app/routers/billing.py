"""
Billing & Usage Router

Adds real Stripe checkout, customer portal, and webhook handling.
"""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.plan_service import PLAN_LIMITS, calculate_overage, estimate_sync_cost_brl, get_user_usage
from app.services.stripe_service import (
    construct_event,
    create_checkout_session,
    create_customer_portal_session,
    sync_subscription_by_customer,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

PLAN_PRICING = [
    {
        "slug": "free",
        "name": "Gratis",
        "price_brl": 0,
        "price_annual_brl": 0,
        "description": "Teste o Sentimenta com 500 comentarios/mes.",
    },
    {
        "slug": "starter",
        "name": "Starter",
        "price_brl": 97,
        "price_annual_brl": 77,
        "description": "Para criadores e marcas pequenas.",
    },
    {
        "slug": "pro",
        "name": "Pro",
        "price_brl": 247,
        "price_annual_brl": 197,
        "description": "Para marcas e profissionais em crescimento.",
        "highlight": True,
    },
    {
        "slug": "business",
        "name": "Business",
        "price_brl": 597,
        "price_annual_brl": 477,
        "description": "Para agencias e operacoes com alto volume.",
    },
    {
        "slug": "enterprise",
        "name": "Enterprise",
        "price_brl": 0,
        "price_annual_brl": 0,
        "description": "Volume ilimitado, SLA dedicado e onboarding.",
    },
]


class CheckoutSessionRequest(BaseModel):
    plan_slug: str = Field(pattern=r"^(starter|pro|business|enterprise)$")


@router.get("/plans")
def get_plans():
    plans = []
    for pricing in PLAN_PRICING:
        slug = pricing["slug"]
        plans.append({**pricing, "limits": PLAN_LIMITS.get(slug, {})})
    return {"plans": plans}


@router.get("/usage")
def get_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    usage = get_user_usage(db, current_user)
    return {
        "plan": current_user.plan,
        "subscription_status": current_user.subscription_status,
        "usage": usage,
    }


@router.get("/estimate")
def estimate_cost(num_posts: int = 10, avg_comments: int = 50):
    cost = estimate_sync_cost_brl(num_posts, avg_comments)
    return {
        "num_posts": num_posts,
        "avg_comments_per_post": avg_comments,
        "total_comments": num_posts * avg_comments,
        "estimated_cost_brl": cost,
    }


@router.post("/checkout-session")
def create_checkout(
    payload: CheckoutSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        url = create_checkout_session(db, current_user, payload.plan_slug)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"url": url}


@router.post("/portal-session")
def create_portal(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        url = create_customer_portal_session(db, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"url": url}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(None, alias="Stripe-Signature"),
    db: Session = Depends(get_db),
):
    payload = await request.body()
    try:
        event = construct_event(payload, stripe_signature)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Stripe webhook verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook")

    event_type = event.get("type")
    obj = (event.get("data") or {}).get("object", {})

    if event_type == "checkout.session.completed":
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")
        user_id = (obj.get("metadata") or {}).get("user_id")
        subscription = {"id": subscription_id, "status": "active", "metadata": obj.get("metadata") or {}}
        sync_subscription_by_customer(db, customer_id, subscription, user_id=user_id)
    elif event_type in {"customer.subscription.created", "customer.subscription.updated"}:
        customer_id = obj.get("customer")
        sync_subscription_by_customer(db, customer_id, obj)
    elif event_type == "customer.subscription.deleted":
        customer_id = obj.get("customer")
        sync_subscription_by_customer(db, customer_id, None)
    elif event_type == "invoice.payment_failed":
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")
        if customer_id:
            current = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if current:
                current.subscription_status = "past_due"
                current.stripe_subscription_id = subscription_id or current.stripe_subscription_id
                db.add(current)
                db.commit()

    return {"received": True}
