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
    first_name: Mapped[str] = mapped_column(nullable=False)
    last_name: Mapped[str] = mapped_column(nullable=False)
    display_name: Mapped[str] = mapped_column(nullable=False)
    bio: Mapped[str | None] = mapped_column()
    team_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("teams.id"),
        nullable=True
    )
    team: Mapped["Team | None"] = relationship(back_populates="users")
    