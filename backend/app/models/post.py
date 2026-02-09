import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, UniqueConstraint, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("social_connections.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    platform_post_id: Mapped[str] = mapped_column(String(255), nullable=False)
    post_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_clean: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_urls: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    share_count: Mapped[int] = mapped_column(Integer, default=0)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    post_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("connection_id", "platform_post_id", name="uq_connection_post"),
    )

    # Relationships
    connection = relationship("SocialConnection", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    analysis_summary = relationship("PostAnalysisSummary", back_populates="post", uselist=False, cascade="all, delete-orphan")
