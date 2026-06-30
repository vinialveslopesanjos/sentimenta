"""merge blog and apify heads

Revision ID: d3e4f5a6b7c8
Revises: b42d3a64f901, cc2a68b89ef7
Create Date: 2026-06-30 00:00:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, tuple[str, str]] = ("b42d3a64f901", "cc2a68b89ef7")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
