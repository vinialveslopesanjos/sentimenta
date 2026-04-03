"""add apify_cost_usd to pipeline_runs

Revision ID: cc2a68b89ef7
Revises: 314b495c3688
Create Date: 2026-03-31 21:05:14.152202

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cc2a68b89ef7'
down_revision: Union[str, None] = '314b495c3688'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pipeline_runs', sa.Column('apify_cost_usd', sa.Float(), server_default='0.0', nullable=False))


def downgrade() -> None:
    op.drop_column('pipeline_runs', 'apify_cost_usd')
