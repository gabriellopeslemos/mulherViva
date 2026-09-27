"""availability rules serve every specialty

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make availability_rules.specialty_id optional (NULL = every specialty)
    and move existing rules to that. Rules were already conflict-checked
    clinic-wide, so this can't create overlapping windows."""
    with op.batch_alter_table('availability_rules') as batch_op:
        batch_op.alter_column('specialty_id', existing_type=sa.Integer(), nullable=True)
    op.execute("UPDATE availability_rules SET specialty_id = NULL")


def downgrade() -> None:
    """The original per-rule specialty can't be recovered; pin NULL rules to
    the first specialty so the NOT NULL constraint can come back."""
    op.execute(
        "UPDATE availability_rules SET specialty_id = (SELECT MIN(id) FROM specialties) "
        "WHERE specialty_id IS NULL"
    )
    with op.batch_alter_table('availability_rules') as batch_op:
        batch_op.alter_column('specialty_id', existing_type=sa.Integer(), nullable=False)
