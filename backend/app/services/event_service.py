"""Everything the application knows how to do with an event.

Routers translate HTTP into these calls and their results back into HTTP.
Nothing in here imports FastAPI, and nothing in here checks permissions - that
belongs to the router, because identity arrives with the request. Keeping this
module HTTP-free is what lets a seed script, a management command, or the Blogs
module reuse the same code later.

Audit logging seam: every mutating function returns the affected Event, and the
router is the layer holding current_user. When Activity Logs arrives, each route
gains one log_activity(...) line and nothing in this file changes. That is the
extension point - no placeholder code, nothing to delete later.
"""

import logging
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.schemas.event import EventCreate, EventUpdate
from app.services.exceptions import InvalidEventTimeRange
from app.services.html_service import sanitize_html

logger = logging.getLogger(__name__)


# Promoted to app/services/exceptions.py when Posts arrived and needed three
# errors of its own - exactly the move the previous version of this comment
# predicted. Re-exported here because the events router refers to it as
# event_service.InvalidEventTimeRange, and moving a class should not force
# every caller to learn where it went.


async def _refresh_for_response(db: AsyncSession, event: Event) -> Event:
    """Reload what the database owns, so the row is safe to serialise.

    Two separate hazards, one fix:

    - updated_at is produced by onupdate=now(), a SQL expression SQLAlchemy
      cannot evaluate, so it is left expired after a flush. Reading it then
      attempts lazy IO and raises MissingGreenlet under async.
    - creator is a relationship. It resolves silently when that user already
      sits in the session identity map and raises MissingGreenlet when it does
      not, which makes it a bug that comes and goes depending on unrelated code
      elsewhere in the same request.
    """
    await db.refresh(event, ["created_at", "updated_at", "creator"])
    return event


async def list_events(
    db: AsyncSession,
    *,
    search: str | None = None,
    include_unpublished: bool = False,
    upcoming: bool | None = None,
    creator_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Event], int]:
    """A page of events, plus how many matched before paging was applied.

    Every flag is keyword-only. list_events(db, True) cannot silently mean
    "include drafts" - a visibility switch should never be a positional
    argument that reads like a typo.

    include_unpublished defaults to False, so a route that forgets to ask for
    drafts shows none. Authorization lives in the router; this default is what
    makes forgetting it harmless instead of a leak.
    """
    conditions = []

    if not include_unpublished:
        conditions.append(Event.published.is_(True))

    if search:
        # ilike is case-insensitive LIKE. The term is a bound parameter, so it
        # stays data rather than SQL no matter what the visitor typed.
        term = f"%{search}%"
        conditions.append(
            or_(Event.title.ilike(term), Event.description.ilike(term))
        )

    if creator_id is not None:
        conditions.append(Event.creator_id == creator_id)

    if upcoming is True:
        conditions.append(Event.start_datetime >= func.now())
    elif upcoming is False:
        conditions.append(Event.start_datetime < func.now())

    # Soonest first when looking forward, most recent first otherwise: either
    # way the events a reader cares about come first. Sorting by id as well
    # keeps paging deterministic - two events sharing a start time are
    # otherwise free to swap places between page 1 and page 2, so one gets
    # shown twice and the other never appears at all.
    order = Event.start_datetime.asc() if upcoming else Event.start_datetime.desc()

    total = await db.scalar(
        select(func.count()).select_from(Event).where(*conditions)
    )

    result = await db.execute(
        select(Event)
        .options(selectinload(Event.creator))
        .where(*conditions)
        .order_by(order, Event.id)
        .limit(limit)
        .offset(offset)
    )

    return list(result.scalars().all()), total or 0


async def get_event(
    db: AsyncSession,
    event_id: UUID,
    *,
    include_unpublished: bool = False,
) -> Event | None:
    """One event, or None when it does not exist or is not visible to the caller.

    Visibility is a condition inside the query rather than a check afterwards,
    so a draft is genuinely not found. The router can answer 404 without having
    to choose between "missing" and "hidden" - and answering 403 would confirm
    the event exists, turning guessed IDs into a working existence oracle.
    """
    conditions = [Event.id == event_id]

    if not include_unpublished:
        conditions.append(Event.published.is_(True))

    result = await db.execute(
        select(Event).options(selectinload(Event.creator)).where(*conditions)
    )

    return result.scalar_one_or_none()


async def create_event(
    db: AsyncSession,
    payload: EventCreate,
    *,
    creator_id: UUID,
) -> Event:
    """Store a new event, attributed to the caller.

    creator_id is a parameter rather than a field on the payload because the
    author comes from the verified session. The schema cannot carry it, so no
    request can claim it.
    """
    # Safe to splat because EventCreate mirrors exactly the columns a human may
    # write, and extra="forbid" keeps it that way. A field added to one and not
    # the other fails loudly here rather than being quietly dropped.
    values = payload.model_dump()

    # Cleaned here rather than at the point it is rendered, so the row is safe
    # for every reader there will ever be. See html_service for why.
    values["description"] = sanitize_html(values["description"])

    event = Event(**values, creator_id=creator_id)

    db.add(event)
    await db.commit()

    logger.info("Event %s created by user %s", event.id, creator_id)

    return await _refresh_for_response(db, event)


async def update_event(
    db: AsyncSession,
    event: Event,
    payload: EventUpdate,
) -> Event:
    """Apply a partial update to an event the router has already loaded."""
    # exclude_unset is what separates "leave the description alone" from "clear
    # the description". Both arrive as None; only the second one lands in this
    # dict, so only the second one overwrites anything.
    changes = payload.model_dump(exclude_unset=True)

    # Only when the caller actually sent one: `in` rather than `.get(...)`, so a
    # PATCH that never mentions the description leaves the stored one untouched
    # instead of overwriting it with the sanitised form of nothing.
    if "description" in changes:
        changes["description"] = sanitize_html(changes["description"])

    # Validate the row as it will exist, not as the payload describes it. A
    # PATCH carrying only end_datetime gives the schema nothing to compare
    # against; here the stored start_datetime is right there on the object.
    start = changes.get("start_datetime", event.start_datetime)
    end = changes.get("end_datetime", event.end_datetime)

    if start is not None and end is not None and end <= start:
        raise InvalidEventTimeRange("end_datetime must be after start_datetime")

    for field, value in changes.items():
        setattr(event, field, value)

    await db.commit()

    logger.info("Event %s updated, fields: %s", event.id, sorted(changes))

    return await _refresh_for_response(db, event)


async def delete_event(db: AsyncSession, event: Event) -> None:
    """Remove an event permanently.

    A hard delete on purpose: the planned Activity Log records who deleted what,
    and soft deletion would put a deleted_at filter on every query this project
    ever writes, where forgetting it once quietly resurrects the row.
    """
    event_id = event.id

    await db.delete(event)
    await db.commit()

    logger.info("Event %s deleted", event_id)
