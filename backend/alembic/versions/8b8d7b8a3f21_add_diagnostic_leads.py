"""add diagnostic leads

Revision ID: 8b8d7b8a3f21
Revises: 1d7bae8d13bb
Create Date: 2026-06-29 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "8b8d7b8a3f21"
down_revision: Union[str, None] = "1d7bae8d13bb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "diagnostic_leads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=64), nullable=False),
        sa.Column("profile_or_post", sa.Text(), nullable=False),
        sa.Column("context", sa.Text(), nullable=True),
        sa.Column("source_path", sa.Text(), nullable=True),
        sa.Column("attribution", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_diagnostic_leads_created_at", "diagnostic_leads", ["created_at"])
    op.create_index("ix_diagnostic_leads_email", "diagnostic_leads", ["email"])
    op.create_index("ix_diagnostic_leads_role", "diagnostic_leads", ["role"])


def downgrade() -> None:
    op.drop_index("ix_diagnostic_leads_role", table_name="diagnostic_leads")
    op.drop_index("ix_diagnostic_leads_email", table_name="diagnostic_leads")
    op.drop_index("ix_diagnostic_leads_created_at", table_name="diagnostic_leads")
    op.drop_table("diagnostic_leads")
