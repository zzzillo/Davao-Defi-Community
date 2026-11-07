"""add event registration url

Revision ID: e17a9a6c12bd
Revises: 684c5f798297
Create Date: 2026-11-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e17a9a6c12bd"
down_revision: Union[str, Sequence[str], None] = "684c5f798297"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("registration_url", sa.String(length=2048), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "registration_url")
