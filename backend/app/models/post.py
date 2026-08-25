from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

# Imported only for the type checker. At runtime SQLAlchemy resolves "User",
# "Event" and "PostImage" from its own registry, so the import never happens and
# the circular reference between these modules never exists.
if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.post_image import PostImage
    from app.models.user import User


class Post(TimestampMixin, Base):
    """A photo recap of something the community did.

    Not a blog entry: the images are the content and the description is the
    caption underneath them. A post may recap an Event, or stand on its own for
    something that never had one - a beach cleanup nobody scheduled.
    """

    __tablename__ = "posts"

    __table_args__ = (
        # One recap per event, enforced by the database rather than by a check
        # in the service.
        #
        # A "look for an existing recap, then insert" check has a race: two
        # requests both look, both find nothing, both insert. No amount of
        # application code closes that window - only a constraint is atomic.
        #
        # It reads as though it would also stop a second standalone post, and it
        # does not: in SQL, NULL is not equal to anything, including another
        # NULL. So this constrains rows that name an event and leaves rows with
        # event_id IS NULL completely unconstrained, which is exactly the rule.
        #
        # Named explicitly so the service can recognise this particular failure
        # and answer 409 instead of a generic database error.
        UniqueConstraint("event_id", name="uq_posts_event_id"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    title: Mapped[str | None] = mapped_column(String(200))

    # The caption. Rich HTML from the editor, cleaned by html_service on write
    # exactly as an event description is - the sanitiser is not events-specific.
    description: Mapped[str | None] = mapped_column(Text)

    location: Mapped[str | None] = mapped_column(String(300))

    # When the thing being recapped actually happened, which is not when the row
    # was written. Uploading beach cleanup photos three weeks later should not
    # file them under today, and created_at already records the upload.
    #
    # DATE, not TIMESTAMPTZ - the one place in this database that deliberately
    # breaks with the others, so it is worth saying why.
    #
    # events.start_datetime is an *instant*: something derives Upcoming from it
    # by comparing against now(), and a reader abroad needs to know when 6pm
    # Manila falls for them. This is a *label*. A recap is published after the
    # fact, nothing counts down to it, and nothing computes state from it - it
    # is sorted by, grouped by, and printed under a title.
    #
    # Storing a label as an instant costs twice. A recap of a 7am cleanup shows
    # as the previous day to a reader whose device is set far enough west, and
    # a late evening one shows as the next day far enough east. Worse, it forces
    # whoever writes the post to pick a time for something that has none - an
    # arbitrary choice that silently decides whether the date reads correctly
    # for everybody else.
    #
    # A DATE carries no timezone, so there is nothing to convert and nothing to
    # get wrong. The cost lands in one place instead: never build one of these
    # with new Date("2026-08-15") on the frontend, which parses as UTC midnight
    # and then renders a day early in the Americas. Format the parts directly.
    post_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Fails closed. A post is a draft until somebody says otherwise, so an
    # accidental POST cannot publish photographs of people to the internet.
    published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # SET NULL rather than CASCADE: deleting an event must not destroy the
    # album. The recap simply becomes standalone, which is a shape the table
    # already supports.
    event_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Same reasoning as Event.creator_id - the community's record outlives
    # whoever posted it, and that is the only reason this is nullable.
    creator_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    creator: Mapped["User | None"] = relationship(back_populates="created_posts")

    # Scalar, not a list: the annotation says "Event | None" and SQLAlchemy
    # infers uselist=False from it. The unique constraint above is what makes
    # that true at the database level rather than merely hoped for.
    event: Mapped["Event | None"] = relationship(back_populates="recap_post")

    images: Mapped[list["PostImage"]] = relationship(
        back_populates="post",
        # delete-orphan is what lets the service drop an image by removing it
        # from this list, rather than issuing a delete by hand.
        cascade="all, delete-orphan",
        # Trust the database's ON DELETE CASCADE instead of loading every child
        # row in order to delete them one at a time.
        passive_deletes=True,
        # Ordering belongs here rather than at each call site, so no caller can
        # forget it and render somebody's gallery shuffled.
        order_by="PostImage.display_order",
    )
