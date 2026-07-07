"""unique running run per connection

Revision ID: b7c9d1e3f5a7
Revises: e5f6a7b8c9d0
Create Date: 2026-07-07 00:00:00.000000

Fecha a janela de corrida do check-then-insert nos routers/tasks: no máximo
uma PipelineRun com status 'running' por conexão. Runs com connection_id NULL
não são afetadas (NULLs são distintos em unique indexes no Postgres).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7c9d1e3f5a7"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEX_NAME = "uq_pipeline_runs_one_running_per_connection"


def upgrade() -> None:
    # Dedup antes do índice: mantém a run 'running' mais recente por conexão
    # e marca as demais como failed (eram duplicatas da corrida TOCTOU).
    op.execute(
        """
        UPDATE pipeline_runs
        SET status = 'failed', ended_at = NOW()
        WHERE status = 'running'
          AND connection_id IS NOT NULL
          AND id NOT IN (
              SELECT DISTINCT ON (connection_id) id
              FROM pipeline_runs
              WHERE status = 'running' AND connection_id IS NOT NULL
              ORDER BY connection_id, started_at DESC NULLS LAST
          )
        """
    )

    op.create_index(
        INDEX_NAME,
        "pipeline_runs",
        ["connection_id"],
        unique=True,
        postgresql_where=sa.text("status = 'running'"),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="pipeline_runs")
