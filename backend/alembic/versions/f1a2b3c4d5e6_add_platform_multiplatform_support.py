"""Add platform to commenter_profiles, fix unique constraints, create usage_log.

Revision ID: f1a2b3c4d5e6
Revises: 1d7bae8d13bb
Create Date: 2026-03-21 00:30:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "f1a2b3c4d5e6"
down_revision: str = "e4e0ce677e7c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. CommenterProfile: add platform column
    op.add_column(
        "commenter_profiles",
        sa.Column("platform", sa.String(50), nullable=False, server_default="instagram"),
    )

    # 2. CommenterProfile: drop old unique on username, add (username, platform)
    op.drop_index("ix_commenter_profiles_username", table_name="commenter_profiles")
    op.create_unique_constraint(
        "uq_cp_username_platform", "commenter_profiles", ["username", "platform"]
    )
    op.create_index("idx_cp_username", "commenter_profiles", ["username"])
    op.create_index("idx_cp_platform", "commenter_profiles", ["platform"])

    # 3. UserEnrichment: make platform NOT NULL, drop old unique on username, add (username, platform)
    op.execute("UPDATE user_enrichment SET platform = 'instagram' WHERE platform IS NULL")
    op.alter_column("user_enrichment", "platform", nullable=False, server_default="instagram")
    op.drop_constraint("user_enrichment_username_key", "user_enrichment", type_="unique")
    op.create_unique_constraint(
        "uq_ue_username_platform", "user_enrichment", ["username", "platform"]
    )
    op.create_index("idx_ue_platform", "user_enrichment", ["platform"])

    # 4. Create usage_log table
    op.create_table(
        "usage_log",
        sa.Column("id", sa.Uuid(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("connection_id", sa.Uuid(), sa.ForeignKey("social_connections.id", ondelete="SET NULL"), nullable=True),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("operation", sa.String(50), nullable=False),
        sa.Column("posts_count", sa.Integer(), server_default="0"),
        sa.Column("comments_count", sa.Integer(), server_default="0"),
        sa.Column("profiles_count", sa.Integer(), server_default="0"),
        sa.Column("estimated_cost_usd", sa.Float(), server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_ul_user_id", "usage_log", ["user_id"])
    op.create_index("idx_ul_platform", "usage_log", ["platform"])
    op.create_index("idx_ul_created_at", "usage_log", ["created_at"])


def downgrade() -> None:
    # Drop usage_log
    op.drop_index("idx_ul_created_at", table_name="usage_log")
    op.drop_index("idx_ul_platform", table_name="usage_log")
    op.drop_index("idx_ul_user_id", table_name="usage_log")
    op.drop_table("usage_log")

    # Revert UserEnrichment
    op.drop_index("idx_ue_platform", table_name="user_enrichment")
    op.drop_constraint("uq_ue_username_platform", "user_enrichment", type_="unique")
    op.create_unique_constraint("user_enrichment_username_key", "user_enrichment", ["username"])
    op.alter_column("user_enrichment", "platform", nullable=True, server_default=None)

    # Revert CommenterProfile
    op.drop_index("idx_cp_platform", table_name="commenter_profiles")
    op.drop_index("idx_cp_username", table_name="commenter_profiles")
    op.drop_constraint("uq_cp_username_platform", "commenter_profiles", type_="unique")
    op.create_index("ix_commenter_profiles_username", "commenter_profiles", ["username"], unique=True)
    op.drop_column("commenter_profiles", "platform")
