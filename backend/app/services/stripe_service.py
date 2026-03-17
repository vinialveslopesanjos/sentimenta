import logging
import json
import uuid
from datetime import datetime, timezone
from typing import Any

import stripe
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.services.email_service import send_plan_upgrade_email

logger = logging.getLogger(__name__)


def _require_stripe() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY


def get_price_config() -> dict[str, str]:
    prices = {
        "starter": settings.STRIPE_PRICE_STARTER,
        "pro": settings.STRIPE_PRICE_PRO,
        "business": settings.STRIPE_PRICE_BUSINESS,
        "enterprise": settings.STRIPE_PRICE_ENTERPRISE,
    }
    return {plan: price_id for plan, price_id in prices.items() if price_id}


def get_plan_from_price(price_id: str | None) -> str | None:
    if not price_id:
        return None
    for plan, configured_price in get_price_config().items():
        if configured_price == price_id:
            return plan
    return None


def get_or_create_customer(db: Session, user: User) -> str:
    _require_stripe()
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        name=user.name,
        metadata={"user_id": str(user.id)},
    )
    user.stripe_customer_id = customer["id"]
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.stripe_customer_id


def create_checkout_session(db: Session, user: User, plan_slug: str) -> str:
    _require_stripe()
    if plan_slug in {"free", "admin"}:
        raise ValueError("Esse plano nao usa checkout do Stripe")

    price_id = get_price_config().get(plan_slug)
    if not price_id:
        raise ValueError(f"Stripe price ID nao configurado para o plano {plan_slug}")

    customer_id = get_or_create_customer(db, user)
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=settings.STRIPE_SUCCESS_URL,
        cancel_url=settings.STRIPE_CANCEL_URL,
        allow_promotion_codes=True,
        client_reference_id=str(user.id),
        metadata={"user_id": str(user.id), "plan": plan_slug},
        subscription_data={"metadata": {"user_id": str(user.id), "plan": plan_slug}},
    )
    return session["url"]


def create_customer_portal_session(db: Session, user: User) -> str:
    _require_stripe()
    customer_id = get_or_create_customer(db, user)
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.APP_URL.rstrip('/')}/dashboard/settings?tab=Plano+%26+Cobranca",
    )
    return session["url"]


def cancel_subscription(subscription_id: str) -> Any:
    _require_stripe()
    return stripe.Subscription.cancel(subscription_id)


def _extract_plan_from_subscription(subscription: dict[str, Any]) -> str:
    items = (((subscription.get("items") or {}).get("data")) or [])
    if items:
        price_id = ((items[0].get("price") or {}).get("id"))
        plan = get_plan_from_price(price_id)
        if plan:
            return plan
    metadata_plan = (subscription.get("metadata") or {}).get("plan")
    return metadata_plan or "free"


def sync_subscription_to_user(
    db: Session,
    user: User,
    subscription: dict[str, Any] | None,
    customer_id: str | None,
) -> User:
    previous_plan = user.plan
    user.stripe_customer_id = customer_id or user.stripe_customer_id

    if not subscription:
        user.plan = "free"
        user.subscription_status = "canceled"
        user.stripe_subscription_id = None
        user.plan_changed_at = datetime.now(timezone.utc)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    next_plan = _extract_plan_from_subscription(subscription)
    user.plan = next_plan
    user.subscription_status = subscription.get("status")
    user.stripe_subscription_id = subscription.get("id")
    user.plan_changed_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)

    if next_plan != previous_plan and next_plan not in {"free", "admin"}:
        try:
            send_plan_upgrade_email(user.email, user.name, next_plan)
        except Exception as exc:
            logger.warning("Failed to send upgrade email to %s: %s", user.email, exc)

    return user


def sync_subscription_by_customer(
    db: Session,
    customer_id: str | None,
    subscription: dict[str, Any] | None,
    user_id: str | None = None,
) -> User | None:
    if not customer_id and not user_id:
        return None

    user = None
    if customer_id:
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user and user_id:
        try:
            user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        except ValueError:
            user = None
    if not user:
        return None
    return sync_subscription_to_user(db, user, subscription, customer_id)


def construct_event(payload: bytes, signature: str | None) -> dict[str, Any]:
    _require_stripe()
    if settings.STRIPE_WEBHOOK_SECRET:
        if not signature:
            raise ValueError("Missing Stripe signature header")
        return stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )
    raise ValueError("STRIPE_WEBHOOK_SECRET is required — configure it in .env")
