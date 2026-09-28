"""drop "Integrativa"/"Humanizada"/"Medicina" from specialty names and slugs

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0006'
down_revision: Union[str, Sequence[str], None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (old_slug, old_name, new_slug, new_name)
RENAMES = [
    ("ginecologia-integrativa", "Ginecologia Integrativa", "ginecologia", "Ginecologia"),
    ("obstetricia-humanizada", "Obstetrícia Humanizada", "obstetricia", "Obstetrícia"),
    ("medicina-ortomolecular", "Medicina Ortomolecular", "ortomolecular", "Ortomolecular"),
]


def _rename(from_slug, from_name, to_slug, to_name) -> None:
    op.execute(
        sa.text("UPDATE specialties SET slug = :to WHERE slug = :src").bindparams(
            to=to_slug, src=from_slug
        )
    )
    # Only rows still carrying the seeded name, so admin renames are kept.
    op.execute(
        sa.text("UPDATE specialties SET name = :to WHERE name = :src").bindparams(
            to=to_name, src=from_name
        )
    )


def upgrade() -> None:
    """A medical specialty followed by "Integrativa"/"Humanizada" reads as a
    distinct specialty, which the clinic can't advertise. "Medicina" is dropped
    from Ortomolecular so all three fit the booking cards the same way."""
    for old_slug, old_name, new_slug, new_name in RENAMES:
        _rename(old_slug, old_name, new_slug, new_name)


def downgrade() -> None:
    for old_slug, old_name, new_slug, new_name in RENAMES:
        _rename(new_slug, new_name, old_slug, old_name)
