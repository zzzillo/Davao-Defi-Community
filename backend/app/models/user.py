from typing import TYPE_CHECKING

from uuid import UUID, uuid4
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from sqlalchemy import ForeignKey

if TYPE_CHECKING:
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
    team_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("teams.id"),
        nullable=True
    )
    team: Mapped["Team | None"] = relationship(back_populates="users")
    