"""create user profiles when invitations are issued

Revision ID: f2c0a97d6b31
Revises: d85bb5c04c29, d3a9e4f81b20
Create Date: 2026-11-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f2c0a97d6b31"
down_revision: Union[str, Sequence[str], None] = (
    "d85bb5c04c29",
    "d3a9e4f81b20",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "clerk_user_id", existing_type=sa.String(), nullable=True)
    op.add_column(
        "user_invitations",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Preserve the association for accounts that accepted before this rollout.
    op.execute(sa.text("""
        UPDATE user_invitations AS invitation
        SET user_id = users.id
        FROM users
        WHERE invitation.accepted_clerk_user_id = users.clerk_user_id
          AND invitation.user_id IS NULL
    """))

    # Turn outstanding and accepted invitations into editable application users.
    op.execute(sa.text("""
        WITH eligible AS (
            SELECT DISTINCT ON (invitation.email) invitation.*
            FROM user_invitations AS invitation
            WHERE invitation.user_id IS NULL
              AND invitation.status IN ('pending', 'failed', 'accepted')
            ORDER BY invitation.email, invitation.created_at DESC, invitation.id DESC
        ), inserted AS (
            INSERT INTO users (
                id, clerk_user_id, email, display_name, bio, alias, positions,
                contributions, social_links, role, status, permissions
            )
            SELECT
                gen_random_uuid(), NULL, eligible.email,
                COALESCE(eligible.profile_details->>'display_name', split_part(eligible.email, '@', 1)),
                eligible.profile_details->>'bio',
                eligible.profile_details->>'alias',
                COALESCE(ARRAY(
                    SELECT jsonb_array_elements_text(eligible.profile_details->'positions')
                )::varchar[], ARRAY[]::varchar[]),
                COALESCE(eligible.profile_details->'contributions', '[]'::jsonb),
                COALESCE(eligible.profile_details->'social_links', '{}'::jsonb),
                eligible.assigned_role, 'active', ARRAY[]::varchar[]
            FROM eligible
            RETURNING id, email
        )
        UPDATE user_invitations AS invitation
        SET user_id = inserted.id
        FROM inserted
        WHERE invitation.email = inserted.email
          AND invitation.user_id IS NULL
          AND invitation.status IN ('pending', 'failed', 'accepted')
    """))
    op.create_foreign_key(
        "fk_user_invitations_user_id_users",
        "user_invitations",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_user_invitations_user_id", "user_invitations", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_invitations_user_id", table_name="user_invitations")
    op.drop_constraint("fk_user_invitations_user_id_users", "user_invitations", type_="foreignkey")
    op.drop_column("user_invitations", "user_id")
    # Placeholder profiles may have been edited after upgrade. Keep them and
    # leave the identity column nullable to avoid a destructive rollback.
