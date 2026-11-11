"""stage 3 clerk invitation and webhook lifecycle

Revision ID: a45c7f2d91de
Revises: ef784a036b2a
Create Date: 2026-11-09 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a45c7f2d91de"
down_revision: Union[str, Sequence[str], None] = "ef784a036b2a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("clerk_updated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("clerk_event_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("clerk_deleted_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("user_invitations", sa.Column("accepted_clerk_user_id", sa.String(255), nullable=True))
    op.add_column("user_invitations", sa.Column("idempotency_key", sa.String(128), nullable=True))
    op.add_column("user_invitations", sa.Column("delivery_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "user_invitations",
        sa.Column("delivery_attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("user_invitations", sa.Column("clerk_event_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint(
        "uq_user_invitations_inviter_idempotency",
        "user_invitations",
        ["invited_by_user_id", "idempotency_key"],
    )
    op.create_index(
        "ix_user_invitations_email_created", "user_invitations", ["email", "created_at"], unique=False
    )

    op.create_table(
        "clerk_webhook_events",
        sa.Column("event_id", sa.String(255), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("event_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("event_id"),
    )


def downgrade() -> None:
    op.drop_table("clerk_webhook_events")
    op.drop_index("ix_user_invitations_email_created", table_name="user_invitations")
    op.drop_constraint(
        "uq_user_invitations_inviter_idempotency", "user_invitations", type_="unique"
    )
    op.drop_column("user_invitations", "clerk_event_at")
    op.drop_column("user_invitations", "delivery_attempts")
    op.drop_column("user_invitations", "delivery_started_at")
    op.drop_column("user_invitations", "idempotency_key")
    op.drop_column("user_invitations", "accepted_clerk_user_id")
    op.drop_column("users", "clerk_deleted_at")
    op.drop_column("users", "clerk_event_at")
    op.drop_column("users", "clerk_updated_at")
