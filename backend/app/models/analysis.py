import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, ForeignKey, UniqueConstraint, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CommentAnalysis(Base):
    __tablename__ = "comment_analysis"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    comment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("comments.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(20), nullable=False)
    score_0_10: Mapped[float | None] = mapped_column(Float, nullable=True)
    polarity: Mapped[float | None] = mapped_column(Float, nullable=True)
    intensity: Mapped[float | None] = mapped_column(Float, nullable=True)
    emotions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    topics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sarcasm: Mapped[bool] = mapped_column(Boolean, default=False)
    summary_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_estimate_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw_llm_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    analyzed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("comment_id", "model", "prompt_version", name="uq_comment_model_version"),
    )

    # Relationships
    comment = relationship("Comment", back_populates="analyses")


class PostAnalysisSummary(Base):
    __tablename__ = "post_analysis_summary"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("posts.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
    total_comments: Mapped[int] = mapped_column(Integer, default=0)
    total_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    avg_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_polarity: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_intensity: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    weighted_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    emotions_distribution: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    topics_frequency: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sentiment_distribution: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    post = relationship("Post", back_populates="analysis_summary")
