"""Stage 6 transactional resource change notifications.

Revision ID: c1db5f4e31a8
Revises: a45c7f2d91de
Create Date: 2026-11-11 00:00:00

"""

from typing import Sequence, Union

from alembic import op


revision: str = "c1db5f4e31a8"
down_revision: Union[str, Sequence[str], None] = "a45c7f2d91de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RESOURCE_TRIGGERS = {
    "events": "events",
    "posts": "posts",
    "blogs": "blogs",
    "partners": "partners",
    "users": "users",
    "user_invitations": "users",
}


def upgrade() -> None:
    # PostgreSQL queues NOTIFY until the mutating transaction commits. The
    # payload contains only an allowlisted resource name; row IDs and values
    # never cross the database notification channel.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION ddc_notify_resource_change()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            PERFORM pg_notify(
                'ddc_resource_changes',
                json_build_object('resource', TG_ARGV[0])::text
            );
            RETURN NULL;
        END;
        $$;
        """
    )

    for table, resource in RESOURCE_TRIGGERS.items():
        op.execute(
            f"""
            CREATE TRIGGER ddc_resource_change_notify
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW
            EXECUTE FUNCTION ddc_notify_resource_change('{resource}')
            """
        )


def downgrade() -> None:
    for table in RESOURCE_TRIGGERS:
        op.execute(f"DROP TRIGGER IF EXISTS ddc_resource_change_notify ON {table}")
    op.execute("DROP FUNCTION IF EXISTS ddc_notify_resource_change()")
