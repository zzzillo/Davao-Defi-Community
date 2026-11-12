"""add partner display order

Revision ID: d3a9e4f81b20
Revises: c1db5f4e31a8
Create Date: 2026-11-12 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d3a9e4f81b20"
down_revision: Union[str, Sequence[str], None] = "c1db5f4e31a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("partners", sa.Column("display_order", sa.Integer(), nullable=True))
    op.execute(
        """
        WITH ordered AS (
            SELECT id, row_number() OVER (ORDER BY lower(name), id) AS position
            FROM partners
        )
        UPDATE partners
        SET display_order = ordered.position
        FROM ordered
        WHERE partners.id = ordered.id
        """
    )
    op.alter_column("partners", "display_order", nullable=False, server_default="0")


def downgrade() -> None:
    op.drop_column("partners", "display_order")
