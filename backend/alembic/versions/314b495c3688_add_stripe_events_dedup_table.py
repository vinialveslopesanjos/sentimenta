"""add_stripe_events_dedup_table

Revision ID: 314b495c3688
Revises: aba0ec583569
Create Date: 2026-03-31 03:09:15.439658

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '314b495c3688'
down_revision: Union[str, None] = 'aba0ec583569'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('stripe_events',
    sa.Column('event_id', sa.String(), nullable=False),
    sa.Column('event_type', sa.String(), nullable=False),
    sa.Column('processed_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('event_id')
    )


def downgrade() -> None:
    op.drop_table('stripe_events')
