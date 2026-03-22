"""add comment_count_api to posts

Revision ID: 4321b70ac164
Revises: f1a2b3c4d5e6
Create Date: 2026-03-22 17:01:39.945654

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4321b70ac164'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('posts', sa.Column('comment_count_api', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('posts', 'comment_count_api')
