"""Require an event's end time to be later than its start."""

from alembic import op


revision = "d85bb5c04c29"
down_revision = "4beee5bcb34f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_events_end_after_start",
        "events",
        "end_datetime IS NULL OR end_datetime > start_datetime",
    )


def downgrade() -> None:
    op.drop_constraint("ck_events_end_after_start", "events", type_="check")
