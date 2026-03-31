"""Demographics models — multi-platform commenter profiles & enrichment.

Tables:
- commenter_profiles: Scraped profile data for commenters (all platforms)
- user_enrichment: LLM-inferred demographics (one per username+platform)
- usage_log: Tracking de custo por operação/usuário/plataforma
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Boolean, Float, String, Text, Integer, DateTime, Index, Uuid,
    UniqueConstraint, ForeignKey,
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
        String(255), nullable=False
    )
    platform: Mapped[str] = mapped_column(
        String(50), nullable=False, default="instagram"
    )
    full_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    location_field: Mapped[str | None] = mapped_column(String(500), nullable=True)
    profile_pic_url_hd: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    followers_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    following_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_business: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    scraped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("username", "platform", name="uq_cp_username_platform"),
        Index("idx_cp_username", "username"),
        Index("idx_cp_platform", "platform"),
    )

    # Relationships
    enrichment = relationship(
        "UserEnrichment",
        primaryjoin="and_(CommenterProfile.username == foreign(UserEnrichment.username), CommenterProfile.platform == foreign(UserEnrichment.platform))",
        uselist=False,
        viewonly=True,
    )


class UserEnrichment(Base):
    __tablename__ = "user_enrichment"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    platform: Mapped[str] = mapped_column(
        String(50), nullable=False, default="instagram"
    )

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
    had_photo: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    had_bio: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    had_location_field: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    evidence_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    computed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("username", "platform", name="uq_ue_username_platform"),
        Index("idx_ue_username", "username"),
        Index("idx_ue_platform", "platform"),
        Index("idx_ue_gender", "gender_label"),
        Index("idx_ue_age", "age_band"),
        Index("idx_ue_country", "location_country_code"),
    )


class UsageLog(Base):
    """Tracking de custo por operação/usuário/plataforma."""
    __tablename__ = "usage_log"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    connection_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("social_connections.id", ondelete="SET NULL"), nullable=True
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    operation: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "ingest", "demographics", "follower_snapshot"
    posts_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    comments_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    profiles_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("idx_ul_user_id", "user_id"),
        Index("idx_ul_platform", "platform"),
        Index("idx_ul_created_at", "created_at"),
    )
