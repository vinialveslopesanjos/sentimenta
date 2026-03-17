"""merge_heads

Revision ID: 1d7bae8d13bb
Revises: a3f1c8e92d01, d7f6e8b6a4d1
Create Date: 2026-03-16 07:19:39.685897

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1d7bae8d13bb'
down_revision: Union[str, None] = ('a3f1c8e92d01', 'd7f6e8b6a4d1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
