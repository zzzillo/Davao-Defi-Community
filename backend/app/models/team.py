from typing import TYPE_CHECKING

from uuid import UUID, uuid4
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User

class Team(Base):
    __tablename__ = "teams"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    name: Mapped[str] = mapped_column(
        unique=True,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column()
    users: Mapped[list["User"]] = relationship(back_populates="team")
    