from datetime import datetime
from typing import TYPE_CHECKING

from uuid import UUID, uuid4
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.mixins import TimestampMixin
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text

if TYPE_CHECKING:
    from app.models.post import Post
    from app.models.user import User


class Event(TimestampMixin, Base):
    """A community event: a meetup, workshop, or conference.

    Deliberately the template for Blogs and Partners - same file layout, same
    creator relationship, same published flag - so the next module is a copy
    with different fields rather than a fresh set of decisions.
    """

    __tablename__ = "events"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    # Capped in the column, not only in the Pydantic schema. The schema guards
    # the API; the column guards every other writer - a script, psql, a seed.
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # Text rather than String(n): Postgres stores both identically, so a cap
    # here would be a rule that buys nothing. The friendly limit belongs in the
    # schema, where exceeding it can return a readable 422.
    description: Mapped[str | None] = mapped_column(Text)
    # Free text on purpose: "Abreeza, Davao" and "Zoom (link emailed)" are both
    # valid. Nullable because a draft may not have a venue booked yet.
    location: Mapped[str | None] = mapped_column(String(300))
    # timezone=True maps to TIMESTAMPTZ. Without it Postgres discards the
    # offset and 18:00 stops meaning a moment in time. Store UTC-aware here,
    # render local in the browser.
    start_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        # The public list sorts and filters on this column on every request.
        index=True,
    )
    # Nullable: an official usually knows when something starts before they
    # know when it ends. The schema enforces end > start only when end is given.
    end_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # A reference to an image, never the image itself. Binaries in Postgres
    # bloat every backup and make every SELECT heavier for no gain.
    #
    # Holds an object key - "events/<id>/banner.jpg" - rather than a full URL,
    # so the domain the bucket is served from stays configuration instead of
    # becoming data copied across every row. storage_service turns it into a
    # URL, and the API still hands the frontend a plain banner_image_url.
    banner_image_key: Mapped[str | None] = mapped_column(String(500))
    # False by default so nothing reaches the public page by accident.
    # Publishing has to be a decision someone made, not a state they forgot.
    published: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    # SET NULL rather than CASCADE: the community's events outlive whoever
    # posted them. That is also the only reason this is nullable - it is always
    # set on create. "The author left" is a real state; "never had an author"
    # is not.
    creator_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    creator: Mapped["User | None"] = relationship(back_populates="created_events")

    # The event's photo recap, if anyone has posted one.
    #
    # Scalar rather than a list because posts.event_id carries a unique
    # constraint - the database allows only one, so the relationship says one.
    # Nothing enforces this here; it just agrees with what the schema already
    # guarantees.
    recap_post: Mapped["Post | None"] = relationship(back_populates="event")
