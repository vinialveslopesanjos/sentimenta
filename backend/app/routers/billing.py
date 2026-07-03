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

# Pricing Jul/2026 — trial 14d com cartao em todos os planos self-serve.
# Business (R$597) saiu de linha: assinantes existentes seguem em PLAN_LIMITS.
PLAN_PRICING = [
    {
        "slug": "starter",
        "name": "Starter",
        "price_brl": 197,
        "price_annual_brl": 157,
        "trial_days": 14,
        "description": "Para marcas que querem entender sua audiencia.",
    },
    {
        "slug": "pro",
        "name": "Pro",
        "price_brl": 497,
        "price_annual_brl": 397,
        "trial_days": 14,
        "description": "Para agencias e marcas com alto volume, com demographics e API.",
        "highlight": True,
    },
    {
        "slug": "enterprise",
        "name": "Enterprise",
        "price_brl": None,
        "price_annual_brl": None,
        "trial_days": 0,
        "description": "Volume e SLA negociados, onboarding dedicado. Sob consulta.",
        "contact_sales": True,
    },
]


class CheckoutSessionRequest(BaseModel):
    plan_slug: str = Field(pattern=r"^(starter|pro)$")


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


# ─── Credit System Endpoints (ADR-011) ──────────────────────────────

def _configured_pack_ids() -> set[str]:
    """Packs compráveis = apenas os com price ID do Stripe configurado no env."""
    from app.core.config import settings

    price_map = {
        "2500": settings.STRIPE_PRICE_PACK_2500,
        "5000": settings.STRIPE_PRICE_PACK_5000,
        "10000": settings.STRIPE_PRICE_PACK_10000,
    }
    return {pack_id for pack_id, price in price_map.items() if price}


@router.get("/credits")
def get_credits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current credit balance for the authenticated user."""
    from app.services.credit_service import get_balance, get_credits_for_plan, CREDIT_PACKS, DEMOGRAPHIC_CREDIT_COST
    balance = get_balance(db, current_user.id)
    plan_allocation = get_credits_for_plan(current_user.plan)
    available_packs = _configured_pack_ids()
    return {
        **balance,
        "plan": current_user.plan,
        "plan_allocation": plan_allocation,
        "demographic_cost": DEMOGRAPHIC_CREDIT_COST,
        "packs": [
            {"id": k, "credits": v["credits"], "price_brl": v["price_brl"]}
            for k, v in CREDIT_PACKS.items()
            if k in available_packs
        ],
    }


@router.get("/credits/history")
def get_credit_history(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get credit transaction history."""
    from app.services.credit_service import get_transaction_history
    return get_transaction_history(db, current_user.id, limit=limit, offset=offset)


class BuyCreditsRequest(BaseModel):
    pack: str = Field(..., pattern=r"^(2500|5000|10000)$")


@router.post("/credits/buy")
def buy_credits(
    payload: BuyCreditsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for a credit pack purchase."""
    import stripe
    from app.core.config import settings
    from app.services.credit_service import CREDIT_PACKS

    pack = CREDIT_PACKS.get(payload.pack)
    if not pack:
        raise HTTPException(status_code=400, detail="Pacote inválido")

    price_map = {
        "2500": settings.STRIPE_PRICE_PACK_2500,
        "5000": settings.STRIPE_PRICE_PACK_5000,
        "10000": settings.STRIPE_PRICE_PACK_10000,
    }
    price_id = price_map.get(payload.pack)
    if not price_id:
        raise HTTPException(status_code=400, detail="Pacote de créditos não configurado no Stripe. Configure STRIPE_PRICE_PACK_* nas env vars.")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    # Ensure user has a Stripe customer ID
    if not current_user.stripe_customer_id:
        customer = stripe.Customer.create(email=current_user.email, name=current_user.name)
        current_user.stripe_customer_id = customer.id
        db.add(current_user)
        db.commit()

    session = stripe.checkout.Session.create(
        customer=current_user.stripe_customer_id,
        mode="payment",
        line_items=[{"price": price_id, "quantity": 1}],
        metadata={
            "type": "credit_pack",
            "user_id": str(current_user.id),
            "credits": str(pack["credits"]),
        },
        success_url=settings.STRIPE_SUCCESS_URL + "&credits=purchased",
        cancel_url=settings.STRIPE_CANCEL_URL,
    )

    return {"url": session.url, "session_id": session.id}


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

    event_id = event.get("id")
    event_type = event.get("type")
    obj = (event.get("data") or {}).get("object", {})

    # Dedup: skip if this event was already processed (Stripe retries)
    if event_id:
        from app.models.stripe_event import StripeEvent
        if db.query(StripeEvent).filter(StripeEvent.event_id == event_id).first():
            logger.info("Stripe event %s already processed, skipping", event_id)
            return {"received": True, "duplicate": True}
        db.add(StripeEvent(event_id=event_id, event_type=event_type or "unknown"))
        db.flush()

    if event_type == "checkout.session.completed":
        metadata = obj.get("metadata") or {}
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")
        user_id = metadata.get("user_id")

        # Check if this is a credit pack purchase (ADR-011)
        if metadata.get("type") == "credit_pack":
            from app.services.credit_service import grant_pack
            pack_user_id = metadata.get("user_id")
            pack_credits = int(metadata.get("credits", 0))
            session_id = obj.get("id")
            if pack_user_id and pack_credits > 0:
                import uuid as _uuid
                grant_pack(db, _uuid.UUID(pack_user_id), pack_credits, stripe_session_id=session_id)
                db.commit()
                logger.info("Credit pack granted: user=%s credits=%d session=%s", pack_user_id, pack_credits, session_id)
        else:
            # Regular subscription checkout. Busca a subscription real para
            # não sobrescrever o status trialing com "active".
            subscription = {"id": subscription_id, "status": "active", "metadata": metadata}
            if subscription_id:
                try:
                    import stripe
                    real_sub = stripe.Subscription.retrieve(subscription_id)
                    subscription = real_sub.to_dict() if hasattr(real_sub, "to_dict") else dict(real_sub)
                except Exception as exc:
                    logger.warning("Could not retrieve subscription %s: %s", subscription_id, exc)
            sync_subscription_by_customer(db, customer_id, subscription, user_id=user_id)

    elif event_type in {"customer.subscription.created", "customer.subscription.updated"}:
        customer_id = obj.get("customer")
        sync_subscription_by_customer(db, customer_id, obj)

        # Grant initial credits on subscription creation (ADR-011)
        if event_type == "customer.subscription.created":
            from app.services.credit_service import grant_monthly, grant_trial
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if user:
                if obj.get("status") == "trialing":
                    # Trial 14d: teto de TRIAL_CREDITS; créditos cheios só
                    # chegam com o primeiro invoice.paid de valor > 0
                    grant_trial(db, user.id, user.plan)
                else:
                    grant_monthly(db, user.id, user.plan)
                db.commit()

    elif event_type == "customer.subscription.deleted":
        customer_id = obj.get("customer")
        sync_subscription_by_customer(db, customer_id, None)

    elif event_type == "invoice.paid":
        # Monthly credit renewal (ADR-011).
        # amount_paid == 0 cobre a fatura R$0 emitida no início do trial —
        # nesse caso os créditos são os de grant_trial, não os do plano cheio.
        customer_id = obj.get("customer")
        amount_paid = obj.get("amount_paid") or 0
        if customer_id and amount_paid > 0:
            from app.services.credit_service import grant_monthly
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if user and user.subscription_status in {"active", "trialing"}:
                grant_monthly(db, user.id, user.plan)
                db.commit()
                logger.info("Monthly credits renewed for user %s (plan=%s)", user.id, user.plan)

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
