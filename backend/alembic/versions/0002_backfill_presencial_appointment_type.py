"""backfill presencial appointment type

Revision ID: eb4611320808
Revises: 5e7b72d9ec39
Create Date: 2026-09-21 20:34:40.445399

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, Sequence[str], None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Backfill the old 2-way 'presencial' appointment type to 'presencial_bsb'."""
    op.execute(
        "UPDATE appointments SET type = 'presencial_bsb' WHERE type = 'presencial'"
    )


def downgrade() -> None:
    """Data-only migration: no schema to revert, and the original 2-way/3-way
    split can't be reconstructed from 'presencial_bsb' alone."""
    pass
