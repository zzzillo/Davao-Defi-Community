"""stage 2 public contributor slugs and partner ownership

Revision ID: ef784a036b2a
Revises: b0318e2a4c71
Create Date: 2026-11-09 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "ef784a036b2a"
down_revision: Union[str, Sequence[str], None] = "b0318e2a4c71"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("public_slug", sa.String(length=120), nullable=True))
    op.create_unique_constraint("uq_users_public_slug", "users", ["public_slug"])

    op.add_column(
        "partners",
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_partners_creator_id_users",
        "partners",
        "users",
        ["creator_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_partners_creator_id", "partners", ["creator_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_partners_creator_id", table_name="partners")
    op.drop_constraint("fk_partners_creator_id_users", "partners", type_="foreignkey")
    op.drop_column("partners", "creator_id")
    op.drop_constraint("uq_users_public_slug", "users", type_="unique")
    op.drop_column("users", "public_slug")
