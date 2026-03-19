"""add_password_reset_fields

Revision ID: e4e0ce677e7c
Revises: a2d688105e98
Create Date: 2026-03-18 20:54:06.195135

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e4e0ce677e7c'
down_revision: Union[str, None] = 'a2d688105e98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('password_reset_token', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('password_reset_sent_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'password_reset_sent_at')
    op.drop_column('users', 'password_reset_token')
