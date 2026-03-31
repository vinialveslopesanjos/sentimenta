from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String
from app.db.session import Base


class StripeEvent(Base):
    __tablename__ = "stripe_events"

    event_id = Column(String, primary_key=True, index=True)
    event_type = Column(String, nullable=False)
    processed_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
