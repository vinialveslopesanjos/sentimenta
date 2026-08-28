"""merge operational trust and pipeline heads

Revision ID: d9e1f3a5b7c9
Revises: c8a4f2d7b901, c8d0e2f4a6b8
Create Date: 2026-08-28 15:30:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "d9e1f3a5b7c9"
down_revision: Union[str, tuple[str, str]] = (
    "c8a4f2d7b901",
    "c8d0e2f4a6b8",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
