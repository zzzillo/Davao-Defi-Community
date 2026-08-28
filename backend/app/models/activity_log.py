from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class ActivityResource(StrEnum):
    """What kind of thing an action happened to.

    A StrEnum rather than a Postgres ENUM type. A database enum sounds
    stricter and is worse here: adding a value needs ALTER TYPE in a migration,
    and removing one is not possible at all. This is a vocabulary that grows
    every time a module gains a verb, so a new value should be a code change.

    The cost is honest - a hand-written INSERT in psql could store nonsense.
    Nothing reachable through the API can.
    """

    EVENT = "event"
    POST = "post"
    BLOG = "blog"
    PARTNER = "partner"
    USER = "user"


class ActivityAction(StrEnum):
    """What was done. Past tense, because a log records what already happened.

    Deliberately not one value per route. "created" means the same thing for an
    event and a blog, which is what lets the frontend render one sentence
    template per action rather than one per route.

    assigned_team is absent on purpose: PATCH /admin/users/{id}/team does not
    exist yet, and an enum value nothing can emit is dead vocabulary. One line
    to add when that route lands.
    """

    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"
    PROMOTED = "promoted"
    DEMOTED = "demoted"
    UPDATED_PERMISSIONS = "updated_permissions"


class ActivityLog(Base):
    """One thing somebody did, recorded permanently.

    Not a feature module: this is the audit trail every other module writes
    into. Nothing here is created by a member, and nothing here is ever edited.

    NO TimestampMixin, and that is the point of the whole table rather than an
    oversight. The mixin brings updated_at, which on an immutable row would be
    a value that always equals created_at - and worse, a column whose existence
    quietly says "rows here get edited". The router exposes GET and nothing
    else for the same reason: an audit trail you can change is not one.
    """

    __tablename__ = "activity_logs"

    __table_args__ = (
        # THREE INDEXES, MATCHING THE THREE QUERIES, AND NO MORE.
        #
        # This table is write-heavy - every mutation anywhere in the app writes
        # one row - so every index is a tax on every write. Each one has to pay
        # for itself.
        #
        # The composite pairs are the important part. An index whose first
        # column is the filter and whose second is created_at serves the filter
        # AND the ordering in one scan. Separate single-column indexes cannot:
        # Postgres would bitmap them together and then sort the result, which
        # for a filter matching a million rows means sorting a million rows to
        # show twenty.
        #
        # Ascending though every query reads descending. A btree walks
        # backwards at the same cost; DESC in an index only earns its keep for
        # multi-column sorts that mix directions.
        #
        # The bare created_at index cannot be dropped in favour of the others -
        # an unfiltered feed has no leading column to match on.
        Index("ix_activity_logs_created_at", "created_at"),
        Index("ix_activity_logs_user_created", "user_id", "created_at"),
        Index("ix_activity_logs_resource_created", "resource", "created_at"),
        # NOTHING ON action, deliberately. It holds roughly eight values, so any
        # one of them matches an eighth of the table - selective enough that
        # Postgres will usually ignore the index and scan anyway, while the
        # write cost is paid on every insert forever. If filtering by action
        # turns out to happen alongside resource, the answer is to widen
        # ix_activity_logs_resource_created to (resource, action, created_at),
        # not to add a fourth index. That is a measurement, so it waits.
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Who did it. SET NULL rather than CASCADE, matching every other module:
    # deleting a person must not erase the record of what they did.
    #
    # Nullable because the foreign key demands it, not because logs are
    # anonymous - every write sets it.
    #
    # No display-name snapshot alongside it. That would make the row survive the
    # user being deleted, but this codebase has no delete-user route, so SET
    # NULL cannot fire today and the column would be complexity carried for a
    # hypothetical. If user deletion ever lands, add it then.
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # One-directional on purpose: there is no User.activity_logs to match it.
    # That collection would be unbounded and would sit on the model every
    # authenticated request already loads, so the one place it could help is
    # outweighed by the one place it could quietly load ten thousand rows.
    user: Mapped["User | None"] = relationship(lazy="raise")

    # Validated against ActivityAction and ActivityResource at the service
    # boundary. String columns rather than database enums - see the note above.
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    resource: Mapped[str] = mapped_column(String(50), nullable=False)

    # The affected row's id, and deliberately NOT a foreign key.
    #
    # It cannot be one: it points at events, posts, blogs, partners or users
    # depending on what `resource` says, and no single foreign key can express
    # "one of five tables". Giving up referential integrity is the price of one
    # table instead of five.
    #
    # Nullable, and a delete log's value points at something that no longer
    # exists. Both are correct: a log records what happened, not what survives.
    resource_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    # The scraps that make a log line readable: a title, a role change, a name.
    #
    # NAMED details, NOT metadata. `metadata` is reserved by SQLAlchemy's
    # Declarative API - Base.metadata is the MetaData registry every model
    # needs - so the attribute is impossible. Aliasing a `details` attribute to
    # a "metadata" column would work and would mean psql and Python disagree
    # about the column's name forever, which costs more than it buys.
    #
    # JSON rather than columns because the shape genuinely differs per action:
    # {"title": ...} for a created event, {"from": ..., "to": ...} for a role
    # change. As columns those would each be NULL on well over ninety percent
    # of rows, every new action would need a migration, and nothing would stop
    # a row carrying both - a combination that means nothing.
    #
    # JSONB rather than JSON: json keeps the raw text and re-parses it on every
    # read, jsonb stores a parsed binary form that is smaller, faster, and
    # supports containment queries and GIN indexing if a details key ever needs
    # searching. The only thing json preserves is formatting, which nothing
    # here cares about.
    #
    # The database will not validate the contents. That guard lives in
    # activity_log_service, because log_activity is called from Python rather
    # than across an HTTP boundary where a schema would catch it.
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # The only timestamp, stamped by Postgres rather than by Python so the
    # ordering comes from one clock no matter which app instance wrote the row.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
