from typing import TYPE_CHECKING
from enum import StrEnum
from datetime import datetime

from uuid import UUID, uuid4
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PGUUID

from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from app.auth.permissions import Role

if TYPE_CHECKING:
    from app.models.blog import Blog
    from app.models.event import Event
    from app.models.post import Post
    from app.models.team import Team
    from app.models.partner import Partner


class AccountStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('member', 'official', 'admin', 'superadmin')", name="ck_users_role"),
        CheckConstraint("status IN ('active', 'suspended')", name="ck_users_status"),
        CheckConstraint("cardinality(positions) <= 2", name="ck_users_positions_max_two"),
        CheckConstraint(
            "contributor_directory_order IS NULL OR contributor_directory_order >= 0",
            name="ck_users_contributor_directory_order",
        ),
        CheckConstraint("jsonb_typeof(contributions) = 'array'", name="ck_users_contributions_array"),
        CheckConstraint("jsonb_typeof(social_links) = 'object'", name="ck_users_social_links_object"),
        UniqueConstraint("alias", name="uq_users_alias"),
        UniqueConstraint("public_slug", name="uq_users_public_slug"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    clerk_user_id: Mapped[str] = mapped_column(
        unique=True, 
        nullable=False
    )
    # Clerk timestamps let webhook consumers ignore stale events and preserve a
    # deletion tombstone when user.deleted arrives before user.created.
    clerk_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    clerk_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    clerk_deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Clerk leaves these empty for email-only signups, so NULL means
    # "Clerk doesn't know", not "the user has no name".
    first_name: Mapped[str | None] = mapped_column()
    last_name: Mapped[str | None] = mapped_column()
    # Always derived from whatever Clerk does give us, so the UI can rely on it.
    display_name: Mapped[str] = mapped_column(nullable=False)
    bio: Mapped[str | None] = mapped_column()
    profile_photo_key: Mapped[str | None] = mapped_column(String(500))
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    alias: Mapped[str | None] = mapped_column(String(80))
    public_slug: Mapped[str | None] = mapped_column(String(120))
    positions: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list, server_default="{}"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AccountStatus.ACTIVE.value,
        server_default=AccountStatus.ACTIVE.value,
    )
    contributions: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    social_links: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    show_in_contributor_directory: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    contributor_directory_order: Mapped[int | None] = mapped_column(Integer)
    # Authorization source of truth. Clerk proves identity only; this row is
    # loaded for every protected request and owns role/status decisions.
    role: Mapped[str] = mapped_column(
        String,
        nullable=False,
        # default fills new ORM objects, server_default fills rows that already
        # exist when the migration runs.
        default=Role.MEMBER.value,
        server_default=Role.MEMBER.value,
    )
    permissions: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        default=list,
        server_default="{}",
    )
    team_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("teams.id"),
        nullable=True
    )
    team: Mapped["Team | None"] = relationship(back_populates="users")
    # The other half of Event.creator. Deleting a user does not delete their
    # events; the foreign key is SET NULL, so this list simply shortens.
    created_events: Mapped[list["Event"]] = relationship(back_populates="creator")
    created_posts: Mapped[list["Post"]] = relationship(back_populates="creator")
    created_blogs: Mapped[list["Blog"]] = relationship(back_populates="creator")
    created_partners: Mapped[list["Partner"]] = relationship(back_populates="creator")
