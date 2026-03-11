"""add missing indexes and FK cascades

Revision ID: a3f1c8e92d01
Revises: 407ce83b37e3
Create Date: 2026-03-11 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f1c8e92d01'
down_revision: Union[str, None] = '407ce83b37e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Add missing indexes ---
    op.create_index('ix_comments_connection_id', 'comments', ['connection_id'])
    op.create_index('ix_comments_published_at', 'comments', ['published_at'])
    op.create_index('ix_comments_parent_comment_id', 'comments', ['parent_comment_id'])
    op.create_index('ix_pipeline_runs_connection_id', 'pipeline_runs', ['connection_id'])

    # --- Fix FK cascades on comments.connection_id ---
    with op.batch_alter_table('comments') as batch_op:
        batch_op.drop_constraint('comments_connection_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'comments_connection_id_fkey',
            'social_connections',
            ['connection_id'],
            ['id'],
            ondelete='CASCADE',
        )

    # --- Fix FK cascades on pipeline_runs ---
    with op.batch_alter_table('pipeline_runs') as batch_op:
        batch_op.drop_constraint('pipeline_runs_user_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'pipeline_runs_user_id_fkey',
            'users',
            ['user_id'],
            ['id'],
            ondelete='CASCADE',
        )
        batch_op.drop_constraint('pipeline_runs_connection_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'pipeline_runs_connection_id_fkey',
            'social_connections',
            ['connection_id'],
            ['id'],
            ondelete='CASCADE',
        )


def downgrade() -> None:
    # --- Revert FK cascades on pipeline_runs ---
    with op.batch_alter_table('pipeline_runs') as batch_op:
        batch_op.drop_constraint('pipeline_runs_connection_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'pipeline_runs_connection_id_fkey',
            'social_connections',
            ['connection_id'],
            ['id'],
        )
        batch_op.drop_constraint('pipeline_runs_user_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'pipeline_runs_user_id_fkey',
            'users',
            ['user_id'],
            ['id'],
        )

    # --- Revert FK cascade on comments.connection_id ---
    with op.batch_alter_table('comments') as batch_op:
        batch_op.drop_constraint('comments_connection_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'comments_connection_id_fkey',
            'social_connections',
            ['connection_id'],
            ['id'],
        )

    # --- Drop indexes ---
    op.drop_index('ix_pipeline_runs_connection_id', 'pipeline_runs')
    op.drop_index('ix_comments_parent_comment_id', 'comments')
    op.drop_index('ix_comments_published_at', 'comments')
    op.drop_index('ix_comments_connection_id', 'comments')
