"""add immutable data snapshots

Revision ID: f7c9d2e4a6b8
Revises: e5f6a7b8c9d0
Create Date: 2026-08-26 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7c9d2e4a6b8"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "data_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("trigger_run_id", sa.Uuid(), nullable=True),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_platforms", sa.JSON(), nullable=False),
        sa.Column("profiles", sa.JSON(), nullable=False),
        sa.Column("found_count", sa.Integer(), nullable=True),
        sa.Column("eligible_count", sa.Integer(), nullable=True),
        sa.Column("collected_count", sa.Integer(), nullable=True),
        sa.Column("saved_count", sa.Integer(), nullable=True),
        sa.Column("analyzed_count", sa.Integer(), nullable=True),
        sa.Column("valid_count", sa.Integer(), nullable=True),
        sa.Column("ignored_count", sa.Integer(), nullable=True),
        sa.Column("coverage", sa.JSON(), nullable=False),
        sa.Column("health", sa.String(length=50), nullable=False),
        sa.Column("reason_code", sa.String(length=100), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "period_start IS NULL OR period_end IS NULL OR period_start <= period_end",
            name="ck_data_snapshot_period_order",
        ),
        sa.CheckConstraint("found_count IS NULL OR found_count >= 0", name="ck_snapshot_found_nonnegative"),
        sa.CheckConstraint("eligible_count IS NULL OR eligible_count >= 0", name="ck_snapshot_eligible_nonnegative"),
        sa.CheckConstraint("collected_count IS NULL OR collected_count >= 0", name="ck_snapshot_collected_nonnegative"),
        sa.CheckConstraint("saved_count IS NULL OR saved_count >= 0", name="ck_snapshot_saved_nonnegative"),
        sa.CheckConstraint("analyzed_count IS NULL OR analyzed_count >= 0", name="ck_snapshot_analyzed_nonnegative"),
        sa.CheckConstraint("valid_count IS NULL OR valid_count >= 0", name="ck_snapshot_valid_nonnegative"),
        sa.CheckConstraint("ignored_count IS NULL OR ignored_count >= 0", name="ck_snapshot_ignored_nonnegative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_data_snapshots_user_id", "data_snapshots", ["user_id"])
    op.create_index("ix_data_snapshots_trigger_run_id", "data_snapshots", ["trigger_run_id"])
    op.create_index(
        "ix_data_snapshots_user_created",
        "data_snapshots",
        ["user_id", "created_at"],
    )

    # Application listeners protect ORM writes.  The database trigger also
    # blocks bulk SQL updates in PostgreSQL while preserving account deletion.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_data_snapshot_update()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'data_snapshots are immutable; insert a new row';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_prevent_data_snapshot_update
        BEFORE UPDATE ON data_snapshots
        FOR EACH ROW EXECUTE FUNCTION prevent_data_snapshot_update();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_prevent_data_snapshot_update ON data_snapshots")
    op.execute("DROP FUNCTION IF EXISTS prevent_data_snapshot_update()")
    op.drop_index("ix_data_snapshots_user_created", table_name="data_snapshots")
    op.drop_index("ix_data_snapshots_trigger_run_id", table_name="data_snapshots")
    op.drop_index("ix_data_snapshots_user_id", table_name="data_snapshots")
    op.drop_table("data_snapshots")
