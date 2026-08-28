import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    Uuid,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SnapshotImmutableError(RuntimeError):
    """Raised when application code attempts to mutate an existing snapshot."""


class DataSnapshot(Base):
    """Append-only evidence record shared by all analytical surfaces."""

    __tablename__ = "data_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Kept as a trace identifier rather than a foreign key so operational log
    # retention cannot silently mutate or invalidate historical evidence.
    trigger_run_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    source_platforms: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    profiles: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    found_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    eligible_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    collected_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    saved_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    analyzed_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    valid_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ignored_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    coverage: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    health: Mapped[str] = mapped_column(String(50), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(100), nullable=False)
    metrics: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        CheckConstraint(
            "period_start IS NULL OR period_end IS NULL OR period_start <= period_end",
            name="ck_data_snapshot_period_order",
        ),
        CheckConstraint("found_count IS NULL OR found_count >= 0", name="ck_snapshot_found_nonnegative"),
        CheckConstraint("eligible_count IS NULL OR eligible_count >= 0", name="ck_snapshot_eligible_nonnegative"),
        CheckConstraint("collected_count IS NULL OR collected_count >= 0", name="ck_snapshot_collected_nonnegative"),
        CheckConstraint("saved_count IS NULL OR saved_count >= 0", name="ck_snapshot_saved_nonnegative"),
        CheckConstraint("analyzed_count IS NULL OR analyzed_count >= 0", name="ck_snapshot_analyzed_nonnegative"),
        CheckConstraint("valid_count IS NULL OR valid_count >= 0", name="ck_snapshot_valid_nonnegative"),
        CheckConstraint("ignored_count IS NULL OR ignored_count >= 0", name="ck_snapshot_ignored_nonnegative"),
        Index("ix_data_snapshots_user_created", "user_id", "created_at"),
    )


@event.listens_for(DataSnapshot, "before_update", propagate=True)
def _prevent_snapshot_update(mapper, connection, target) -> None:
    raise SnapshotImmutableError(
        f"DataSnapshot {target.id} is immutable; create a new snapshot instead"
    )
