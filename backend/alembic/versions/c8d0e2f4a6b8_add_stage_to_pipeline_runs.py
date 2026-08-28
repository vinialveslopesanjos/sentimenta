"""add stage to pipeline runs

Revision ID: c8d0e2f4a6b8
Revises: b7c9d1e3f5a7
Create Date: 2026-07-07 00:30:00.000000

Etapa atual da run (queued|ingesting|analyzing|demographics|report|done)
para o frontend mostrar progresso granular em vez de só "running".
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c8d0e2f4a6b8"
down_revision: Union[str, None] = "b7c9d1e3f5a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pipeline_runs",
        sa.Column("stage", sa.String(length=30), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pipeline_runs", "stage")
