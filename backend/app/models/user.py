from typing import TYPE_CHECKING

from uuid import UUID, uuid4
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PGUUID

from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from sqlalchemy import ForeignKey, String
from app.auth.permissions import Role

if TYPE_CHECKING:
    from app.models.blog import Blog
    from app.models.event import Event
    from app.models.post import Post
    from app.models.team import Team

class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    clerk_user_id: Mapped[str] = mapped_column(
        unique=True, 
        nullable=False
    )
    # Clerk leaves these empty for email-only signups, so NULL means
    # "Clerk doesn't know", not "the user has no name".
    first_name: Mapped[str | None] = mapped_column()
    last_name: Mapped[str | None] = mapped_column()
    # Always derived from whatever Clerk does give us, so the UI can rely on it.
    display_name: Mapped[str] = mapped_column(nullable=False)
    bio: Mapped[str | None] = mapped_column()
    # Mirror of Clerk publicMetadata. Exists so the admin list can filter and
    # sort in SQL, which a JWT cannot do.
    #
    # NEVER read these to decide access. Clerk signed the token; nothing signed
    # this row. Gating reads CurrentUser, which comes from the token.
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
    