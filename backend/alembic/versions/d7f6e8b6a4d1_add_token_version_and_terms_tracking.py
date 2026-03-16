"""add token version and terms tracking

Revision ID: d7f6e8b6a4d1
Revises: 1aeb68c46273
Create Date: 2026-03-15 23:55:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d7f6e8b6a4d1"
down_revision: Union[str, None] = "1aeb68c46273"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("terms_accepted_ip", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("terms_accepted_version", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "terms_accepted_version")
    op.drop_column("users", "terms_accepted_ip")
    op.drop_column("users", "terms_accepted_at")
    op.drop_column("users", "token_version")
