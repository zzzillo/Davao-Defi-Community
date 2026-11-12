"""Notify resource subscribers when recap images change."""

from alembic import op

revision = "4beee5bcb34f"
down_revision = "c1db5f4e31a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TRIGGER ddc_resource_change_notify
        AFTER INSERT OR UPDATE OR DELETE ON post_images
        FOR EACH ROW
        EXECUTE FUNCTION ddc_notify_resource_change('posts')
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER ddc_resource_change_notify ON post_images")
