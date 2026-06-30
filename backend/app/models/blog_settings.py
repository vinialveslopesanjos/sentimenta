import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class BlogSettings(Base):
    __tablename__ = "blog_settings"
    __table_args__ = (CheckConstraint("id = 1", name="ck_blog_settings_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    nav_pricing_label: Mapped[str] = mapped_column(String(80), nullable=False)
    nav_cta_label: Mapped[str] = mapped_column(String(120), nullable=False)
    nav_cta_href: Mapped[str] = mapped_column(Text, nullable=False)
    hero_eyebrow: Mapped[str] = mapped_column(String(180), nullable=False)
    hero_title: Mapped[str] = mapped_column(String(255), nullable=False)
    hero_description: Mapped[str] = mapped_column(Text, nullable=False)
    search_placeholder: Mapped[str] = mapped_column(String(180), nullable=False)
    hero_cta_label: Mapped[str] = mapped_column(String(120), nullable=False)
    hero_cta_href: Mapped[str] = mapped_column(Text, nullable=False)
    sidebar_title: Mapped[str] = mapped_column(String(180), nullable=False)
    sidebar_description: Mapped[str] = mapped_column(Text, nullable=False)
    sidebar_cta_label: Mapped[str] = mapped_column(String(120), nullable=False)
    sidebar_cta_href: Mapped[str] = mapped_column(Text, nullable=False)
    all_category_label: Mapped[str] = mapped_column(String(80), nullable=False)
    categories: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    empty_state_text: Mapped[str] = mapped_column(String(255), nullable=False)
    article_nav_cta_label: Mapped[str] = mapped_column(String(120), nullable=False)
    article_nav_cta_href: Mapped[str] = mapped_column(Text, nullable=False)
    article_cta_title: Mapped[str] = mapped_column(String(180), nullable=False)
    article_cta_description: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
