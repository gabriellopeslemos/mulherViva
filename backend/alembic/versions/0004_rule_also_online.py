"""availability rules can also take online bookings

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('availability_rules') as batch_op:
        batch_op.add_column(
            sa.Column('also_online', sa.Boolean(), nullable=False, server_default=sa.false())
        )


def downgrade() -> None:
    with op.batch_alter_table('availability_rules') as batch_op:
        batch_op.drop_column('also_online')
