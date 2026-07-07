"""
Credit System — Sentimenta

Manages credit balances and transactions. Credits are the primary unit of
consumption: 1 credit = 1 comment analyzed, 5 credits = 1 demographic profile.

Plan credits renew monthly (expire at cycle end).
Pack credits never expire.
Consumption drains plan credits first, then pack credits.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.credits import CreditBalance, CreditTransaction
from app.models.user import User

logger = logging.getLogger(__name__)

# ─── Credit Allocations per Plan (Pricing Jul/2026) ─────────────────
# "free" = estado sem assinatura (0 créditos); "business" é legado.
PLAN_CREDITS = {
    "free": 0,
    "starter": 10_000,
    "pro": 40_000,
    "business": 40_000,
    "enterprise": 999_999,
    "admin": 999_999,
}

DEMOGRAPHIC_CREDIT_COST = 5  # 1 profile = 5 credits

# Teto de créditos durante o trial de 14 dias (qualquer plano)
TRIAL_CREDITS = 1_000

# ─── Credit Pack Definitions ────────────────────────────────────────
# Preço por crédito nunca abaixo do excedente do plano superior
CREDIT_PACKS = {
    "2500": {"credits": 2_500, "price_brl": 99},
    "5000": {"credits": 5_000, "price_brl": 179},
    "10000": {"credits": 10_000, "price_brl": 299},
}

LEGACY_PLAN_MAP = {
    "creator": "starter",
    "agency": "business",
}


class InsufficientCreditsError(Exception):
    def __init__(self, available: int, required: int, plan: str = ""):
        self.available = available
        self.required = required
        self.plan = plan
        msg = (
            f"Créditos insuficientes: {available} disponíveis, {required} necessários."
        )
        if plan in ("free",):
            msg += " Faça upgrade para ter mais créditos."
        else:
            msg += " Compre um pacote de créditos extras para continuar."
        super().__init__(msg)


def _resolve_plan(plan: str) -> str:
    return LEGACY_PLAN_MAP.get(plan, plan)


def get_credits_for_plan(plan: str) -> int:
    resolved = _resolve_plan(plan)
    return PLAN_CREDITS.get(resolved, PLAN_CREDITS["free"])


def get_or_create_balance(db: Session, user_id) -> CreditBalance:
    """Get existing balance or create one for the user."""
    balance = db.query(CreditBalance).filter(CreditBalance.user_id == user_id).first()
    if balance is None:
        user = db.get(User, user_id)
        credits = get_credits_for_plan(user.plan) if user else 0
        balance = CreditBalance(
            user_id=user_id,
            plan_credits=credits,
            pack_credits=0,
            cycle_start=datetime.now(timezone.utc),
        )
        db.add(balance)
        db.flush()
        _record_transaction(
            db, balance, credits, "grant_monthly", "initial",
            f"Créditos iniciais ({user.plan if user else 'free'})",
        )
    return balance


def get_balance(db: Session, user_id) -> dict:
    """Get credit balance summary for a user."""
    bal = get_or_create_balance(db, user_id)
    return {
        "plan_credits": bal.plan_credits,
        "pack_credits": bal.pack_credits,
        "total": bal.plan_credits + bal.pack_credits,
        "cycle_start": bal.cycle_start.isoformat() if bal.cycle_start else None,
        "cycle_end": bal.cycle_end.isoformat() if bal.cycle_end else None,
    }


def has_enough(db: Session, user_id, amount: int) -> bool:
    """Check if user has enough credits without locking."""
    bal = get_or_create_balance(db, user_id)
    return (bal.plan_credits + bal.pack_credits) >= amount


def consume(
    db: Session,
    user_id,
    amount: int,
    type: str,
    source: str = "sync",
    description: str = None,
    metadata: dict = None,
) -> int:
    """
    Atomically consume credits. Drains plan_credits first (they expire),
    then pack_credits.

    Returns remaining total balance.
    Raises InsufficientCreditsError if not enough.
    """
    # Lock the row to prevent race conditions
    bal = (
        db.query(CreditBalance)
        .filter(CreditBalance.user_id == user_id)
        .with_for_update()
        .first()
    )
    if bal is None:
        bal = get_or_create_balance(db, user_id)
        # Re-lock after creation
        bal = (
            db.query(CreditBalance)
            .filter(CreditBalance.user_id == user_id)
            .with_for_update()
            .one()
        )

    total = bal.plan_credits + bal.pack_credits
    if total < amount:
        user = db.get(User, user_id)
        raise InsufficientCreditsError(total, amount, user.plan if user else "free")

    # Drain plan credits first (they'll expire anyway)
    from_plan = min(bal.plan_credits, amount)
    from_pack = amount - from_plan
    bal.plan_credits -= from_plan
    bal.pack_credits -= from_pack

    remaining = bal.plan_credits + bal.pack_credits

    _record_transaction(
        db, bal, -amount, type, source,
        description or f"Consumo: {amount} créditos",
        metadata,
    )

    logger.info(
        "Credits consumed: user=%s amount=%d type=%s remaining=%d (plan=%d pack=%d)",
        user_id, amount, type, remaining, bal.plan_credits, bal.pack_credits,
    )

    from app.core.analytics import capture
    capture(str(user_id), "credits_consumed", {
        "amount": amount, "type": type, "remaining": remaining,
    })
    if remaining <= 0:
        capture(str(user_id), "credits_depleted", {"type": type})

    return remaining


def consume_up_to(
    db: Session,
    user_id,
    amount: int,
    type: str,
    source: str = "sync",
    description: str = None,
    metadata: dict = None,
) -> int:
    """
    Atomically consume at most `amount` credits, draining whatever is available
    (plan credits first, then pack credits).

    Unlike consume(), never raises InsufficientCreditsError: returns how many
    credits were actually consumed (0..amount). Callers compare the return
    value against `amount` to detect depletion and stop further work.
    """
    if amount <= 0:
        return 0

    bal = (
        db.query(CreditBalance)
        .filter(CreditBalance.user_id == user_id)
        .with_for_update()
        .first()
    )
    if bal is None:
        bal = get_or_create_balance(db, user_id)
        bal = (
            db.query(CreditBalance)
            .filter(CreditBalance.user_id == user_id)
            .with_for_update()
            .one()
        )

    total = bal.plan_credits + bal.pack_credits
    to_consume = min(total, amount)
    if to_consume <= 0:
        return 0

    from_plan = min(bal.plan_credits, to_consume)
    from_pack = to_consume - from_plan
    bal.plan_credits -= from_plan
    bal.pack_credits -= from_pack

    remaining = bal.plan_credits + bal.pack_credits

    _record_transaction(
        db, bal, -to_consume, type, source,
        description or f"Consumo: {to_consume} créditos",
        metadata,
    )

    logger.info(
        "Credits consumed (up_to): user=%s requested=%d consumed=%d type=%s remaining=%d",
        user_id, amount, to_consume, type, remaining,
    )

    from app.core.analytics import capture
    capture(str(user_id), "credits_consumed", {
        "amount": to_consume, "type": type, "remaining": remaining,
    })
    if remaining <= 0:
        capture(str(user_id), "credits_depleted", {"type": type})

    return to_consume


def get_available_credits(db: Session, user_id) -> int:
    """Total credits (plan + pack) currently available, without locking."""
    bal = get_or_create_balance(db, user_id)
    return bal.plan_credits + bal.pack_credits


def grant_monthly(db: Session, user_id, plan: str = None) -> int:
    """
    Reset plan credits for a new billing cycle.
    Called on invoice.paid webhook.
    Pack credits are NOT touched.
    Returns new plan_credits value.
    """
    bal = (
        db.query(CreditBalance)
        .filter(CreditBalance.user_id == user_id)
        .with_for_update()
        .first()
    )

    if bal is None:
        bal = get_or_create_balance(db, user_id)
        bal = (
            db.query(CreditBalance)
            .filter(CreditBalance.user_id == user_id)
            .with_for_update()
            .one()
        )

    if plan is None:
        user = db.get(User, user_id)
        plan = user.plan if user else "free"

    new_credits = get_credits_for_plan(plan)
    old_credits = bal.plan_credits

    bal.plan_credits = new_credits
    bal.cycle_start = datetime.now(timezone.utc)

    _record_transaction(
        db, bal, new_credits, "grant_monthly", "plan_renewal",
        f"Renovação mensal: {new_credits:,} créditos ({plan}). Anterior: {old_credits:,} expirados.",
    )

    logger.info(
        "Monthly credits granted: user=%s plan=%s credits=%d (expired=%d)",
        user_id, plan, new_credits, old_credits,
    )
    return new_credits


def grant_trial(db: Session, user_id, plan: str = None) -> int:
    """
    Grant trial credits when a subscription starts in `trialing` status.
    Caps at TRIAL_CREDITS regardless of plan; full plan credits only come
    with the first real invoice.paid (see billing webhook).
    Returns new plan_credits value.
    """
    bal = (
        db.query(CreditBalance)
        .filter(CreditBalance.user_id == user_id)
        .with_for_update()
        .first()
    )

    if bal is None:
        bal = get_or_create_balance(db, user_id)
        bal = (
            db.query(CreditBalance)
            .filter(CreditBalance.user_id == user_id)
            .with_for_update()
            .one()
        )

    if plan is None:
        user = db.get(User, user_id)
        plan = user.plan if user else "free"

    trial_credits = min(TRIAL_CREDITS, get_credits_for_plan(plan))
    bal.plan_credits = trial_credits
    bal.cycle_start = datetime.now(timezone.utc)

    _record_transaction(
        db, bal, trial_credits, "grant_trial", "trial_start",
        f"Trial de 14 dias iniciado: {trial_credits:,} créditos ({plan}).",
    )

    logger.info(
        "Trial credits granted: user=%s plan=%s credits=%d",
        user_id, plan, trial_credits,
    )
    return trial_credits


def grant_pack(
    db: Session,
    user_id,
    amount: int,
    stripe_session_id: str = None,
) -> int:
    """
    Add pack credits (purchased). These never expire.
    Returns new total balance.
    """
    bal = (
        db.query(CreditBalance)
        .filter(CreditBalance.user_id == user_id)
        .with_for_update()
        .first()
    )

    if bal is None:
        bal = get_or_create_balance(db, user_id)
        bal = (
            db.query(CreditBalance)
            .filter(CreditBalance.user_id == user_id)
            .with_for_update()
            .one()
        )

    bal.pack_credits += amount

    metadata = {}
    if stripe_session_id:
        metadata["stripe_session_id"] = stripe_session_id

    _record_transaction(
        db, bal, amount, "grant_pack", "pack_purchase",
        f"Pacote de {amount:,} créditos adicionado.",
        metadata if metadata else None,
    )

    total = bal.plan_credits + bal.pack_credits
    logger.info(
        "Pack credits granted: user=%s amount=%d total=%d session=%s",
        user_id, amount, total, stripe_session_id,
    )

    from app.core.analytics import capture
    capture(str(user_id), "credits_pack_purchased", {"amount": amount, "total": total})

    return total


def get_transaction_history(
    db: Session, user_id, limit: int = 50, offset: int = 0,
) -> list[dict]:
    """Get credit transaction history for a user."""
    bal = db.query(CreditBalance).filter(CreditBalance.user_id == user_id).first()
    if not bal:
        return []

    txns = (
        db.query(CreditTransaction)
        .filter(CreditTransaction.balance_id == bal.id)
        .order_by(CreditTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(txn.id),
            "amount": txn.amount,
            "type": txn.type,
            "source": txn.source,
            "balance_after": txn.balance_after,
            "description": txn.description,
            "metadata": txn.metadata_json,
            "created_at": txn.created_at.isoformat(),
        }
        for txn in txns
    ]


# ─── Internal ───────────────────────────────────────────────────────

def _record_transaction(
    db: Session,
    balance: CreditBalance,
    amount: int,
    type: str,
    source: str,
    description: str = None,
    metadata: dict = None,
) -> CreditTransaction:
    txn = CreditTransaction(
        user_id=balance.user_id,
        balance_id=balance.id,
        amount=amount,
        type=type,
        source=source,
        balance_after=balance.plan_credits + balance.pack_credits,
        description=description,
        metadata_json=metadata,
    )
    db.add(txn)
    return txn
