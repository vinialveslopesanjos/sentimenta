import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, UniqueConstraint, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("social_connections.id"), nullable=False
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    platform_comment_id: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_comment_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("comments.id"), nullable=True
    )
    source_type: Mapped[str] = mapped_column(String(50), default="comment")
    author_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    author_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    author_profile_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    reply_count: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    text_original: Mapped[str] = mapped_column(Text, nullable=False)
    text_clean: Mapped[str] = mapped_column(Text, nullable=False)
    text_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("post_id", "platform_comment_id", name="uq_post_comment"),
    )

    # Relationships
    post = relationship("Post", back_populates="comments")
    connection = relationship("SocialConnection", back_populates="comments")
    parent = relationship("Comment", remote_side="Comment.id", backref="replies")
    analyses = relationship("CommentAnalysis", back_populates="comment", cascade="all, delete-orphan")
