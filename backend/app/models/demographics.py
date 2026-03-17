"""Demographics models — matches lab schema exactly.

Tables:
- commenter_profiles: Scraped Instagram profile data for commenters
- user_enrichment: LLM-inferred demographics (global, one per username)
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Float, String, Text, Integer, DateTime, Index, Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CommenterProfile(Base):
    __tablename__ = "commenter_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    full_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    location_field: Mapped[str | None] = mapped_column(String(500), nullable=True)
    profile_pic_url_hd: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    followers_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    following_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_business: Mapped[bool] = mapped_column(Boolean, default=False)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    scraped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_cp_username", "username"),
    )

    # Relationships
    enrichment = relationship(
        "UserEnrichment",
        primaryjoin="CommenterProfile.username == foreign(UserEnrichment.username)",
        uselist=False,
        viewonly=True,
    )


class UserEnrichment(Base):
    __tablename__ = "user_enrichment"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    platform: Mapped[str] = mapped_column(String(50), default="instagram")

    # Gender
    gender_label: Mapped[str | None] = mapped_column(String(20), nullable=True)
    gender_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Age
    age_band: Mapped[str | None] = mapped_column(String(20), nullable=True)
    age_estimated: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Location
    location_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location_country_code: Mapped[str | None] = mapped_column(String(5), nullable=True)
    location_country_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_state: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location_state_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location_city_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Metadata
    source_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    had_photo: Mapped[bool] = mapped_column(Boolean, default=False)
    had_bio: Mapped[bool] = mapped_column(Boolean, default=False)
    had_location_field: Mapped[bool] = mapped_column(Boolean, default=False)
    evidence_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("idx_ue_username", "username"),
        Index("idx_ue_gender", "gender_label"),
        Index("idx_ue_age", "age_band"),
        Index("idx_ue_country", "location_country_code"),
    )
