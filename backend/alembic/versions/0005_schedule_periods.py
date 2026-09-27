"""vigências become schedule_periods that own the rules

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005'
down_revision: Union[str, Sequence[str], None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Each distinct (start_date, end_date) pair among existing rules becomes a
    period holding those rules. Legacy rules whose date ranges overlapped
    without sharing identical bounds now fall under the "most specific period
    wins" precedence instead of stacking — review them in the admin after
    upgrading."""
    op.create_table(
        'schedule_periods',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
    )
    with op.batch_alter_table('availability_rules') as batch_op:
        batch_op.add_column(sa.Column('period_id', sa.Integer(), nullable=True))

    conn = op.get_bind()
    pairs = conn.execute(
        sa.text("SELECT DISTINCT start_date, end_date FROM availability_rules")
    ).fetchall()
    for start_date, end_date in pairs:
        period_id = conn.execute(
            sa.text(
                "INSERT INTO schedule_periods (start_date, end_date) VALUES (:s, :e)"
            ),
            {"s": start_date, "e": end_date},
        ).lastrowid
        conn.execute(
            sa.text(
                "UPDATE availability_rules SET period_id = :p "
                "WHERE start_date IS :s AND end_date IS :e"
            ),
            {"p": period_id, "s": start_date, "e": end_date},
        )

    with op.batch_alter_table('availability_rules') as batch_op:
        batch_op.alter_column('period_id', existing_type=sa.Integer(), nullable=False)
        batch_op.create_foreign_key(
            'fk_availability_rules_period_id',
            'schedule_periods',
            ['period_id'],
            ['id'],
            ondelete='CASCADE',
        )
        batch_op.create_index('ix_availability_rules_period_id', ['period_id'])
        batch_op.drop_column('start_date')
        batch_op.drop_column('end_date')


def downgrade() -> None:
    """Copy each period's bounds back onto its rules. Precedence between
    overlapping periods can't be expressed per rule, so overlapping periods
    go back to stacking."""
    with op.batch_alter_table('availability_rules') as batch_op:
        batch_op.add_column(sa.Column('start_date', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('end_date', sa.Date(), nullable=True))
    op.execute(
        "UPDATE availability_rules SET "
        "start_date = (SELECT start_date FROM schedule_periods p WHERE p.id = period_id), "
        "end_date = (SELECT end_date FROM schedule_periods p WHERE p.id = period_id)"
    )
    with op.batch_alter_table('availability_rules') as batch_op:
        batch_op.drop_index('ix_availability_rules_period_id')
        batch_op.drop_constraint('fk_availability_rules_period_id', type_='foreignkey')
        batch_op.drop_column('period_id')
    op.drop_table('schedule_periods')
