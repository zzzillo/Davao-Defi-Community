"""add member profile and storage foundation

Revision ID: b0318e2a4c71
Revises: e17a9a6c12bd
Create Date: 2026-11-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b0318e2a4c71"
down_revision: Union[str, Sequence[str], None] = "e17a9a6c12bd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLE_VALUES = "'member', 'official', 'admin', 'superadmin'"


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_photo_key", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(320), nullable=True))
    op.create_index("ix_users_email", "users", ["email"], unique=False)
    op.add_column("users", sa.Column("alias", sa.String(80), nullable=True))
    op.create_unique_constraint("uq_users_alias", "users", ["alias"])
    op.add_column(
        "users",
        sa.Column("positions", postgresql.ARRAY(sa.String()), server_default="{}", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column(
            "contributions",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "social_links",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "show_in_contributor_directory",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column("users", sa.Column("contributor_directory_order", sa.Integer(), nullable=True))
    op.create_check_constraint("ck_users_role", "users", f"role IN ({ROLE_VALUES})")
    op.create_check_constraint(
        "ck_users_status", "users", "status IN ('active', 'suspended')"
    )
    op.create_check_constraint(
        "ck_users_positions_max_two", "users", "cardinality(positions) <= 2"
    )
    op.create_check_constraint(
        "ck_users_contributor_directory_order",
        "users",
        "contributor_directory_order IS NULL OR contributor_directory_order >= 0",
    )
    op.create_check_constraint(
        "ck_users_contributions_array", "users", "jsonb_typeof(contributions) = 'array'"
    )
    op.create_check_constraint(
        "ck_users_social_links_object", "users", "jsonb_typeof(social_links) = 'object'"
    )
    op.create_table(
        "user_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("assigned_role", sa.String(20), server_default="member", nullable=False),
        sa.Column("profile_details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("invited_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("clerk_invitation_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.String(100), nullable=True),
        sa.CheckConstraint(
            f"assigned_role IN ({ROLE_VALUES})", name="ck_user_invitations_assigned_role"
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'revoked', 'expired', 'failed')",
            name="ck_user_invitations_status",
        ),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clerk_invitation_id", name="uq_user_invitations_clerk_invitation_id"),
    )
    op.create_index(
        "ix_user_invitations_email_status", "user_invitations", ["email", "status"], unique=False
    )

    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(500), nullable=False),
        sa.Column("uploaded_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("purpose", sa.String(50), nullable=False),
        sa.Column("validation_status", sa.String(20), server_default="pending", nullable=False),
        sa.Column(
            "metadata", postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "validation_status IN ('pending', 'valid', 'invalid')",
            name="ck_media_assets_validation_status",
        ),
        sa.CheckConstraint("length(purpose) > 0", name="ck_media_assets_purpose_nonempty"),
        sa.CheckConstraint("jsonb_typeof(metadata) = 'object'", name="ck_media_assets_metadata_object"),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_media_assets_key"),
    )
    op.create_index(
        "ix_media_assets_uploader_created",
        "media_assets",
        ["uploaded_by_user_id", "created_at"],
        unique=False,
    )

    op.add_column(
        "activity_logs",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "activity_logs",
        sa.Column("audience", sa.String(20), server_default="private", nullable=False),
    )
    op.create_foreign_key(
        "fk_activity_logs_owner_id_users",
        "activity_logs",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_check_constraint(
        "ck_activity_logs_audience",
        "activity_logs",
        "audience IN ('private', 'shared', 'user_management')",
    )
    op.create_index(
        "ix_activity_logs_owner_created", "activity_logs", ["owner_id", "created_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_activity_logs_owner_created", table_name="activity_logs")
    op.drop_constraint("ck_activity_logs_audience", "activity_logs", type_="check")
    op.drop_constraint("fk_activity_logs_owner_id_users", "activity_logs", type_="foreignkey")
    op.drop_column("activity_logs", "audience")
    op.drop_column("activity_logs", "owner_id")

    op.drop_index("ix_media_assets_uploader_created", table_name="media_assets")
    op.drop_table("media_assets")

    op.drop_index("ix_user_invitations_email_status", table_name="user_invitations")
    op.drop_table("user_invitations")

    op.drop_constraint("ck_users_contributor_directory_order", "users", type_="check")
    op.drop_constraint("ck_users_social_links_object", "users", type_="check")
    op.drop_constraint("ck_users_contributions_array", "users", type_="check")
    op.drop_constraint("ck_users_positions_max_two", "users", type_="check")
    op.drop_constraint("ck_users_status", "users", type_="check")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_column("users", "contributor_directory_order")
    op.drop_column("users", "show_in_contributor_directory")
    op.drop_column("users", "social_links")
    op.drop_column("users", "contributions")
    op.drop_column("users", "status")
    op.drop_column("users", "profile_photo_key")
    op.drop_constraint("uq_users_alias", "users", type_="unique")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "positions")
    op.drop_column("users", "alias")
    op.drop_column("users", "email")
