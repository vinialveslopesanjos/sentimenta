import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, Integer, String, Text, DateTime, Uuid, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CreditBalance(Base):
    __tablename__ = "credit_balances"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    plan_credits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pack_credits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cycle_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cycle_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", backref="credit_balance", uselist=False)
    transactions = relationship("CreditTransaction", back_populates="balance", order_by="CreditTransaction.created_at.desc()")


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"
    __table_args__ = (
        Index("idx_credit_tx_user_date", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    balance_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("credit_balances.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    balance = relationship("CreditBalance", back_populates="transactions")
