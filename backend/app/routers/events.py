from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    CurrentUser,
    assert_may_see_drafts,
    get_current_db_user,
    get_optional_user,
    require_permission,
)
from app.auth.permissions import Permission
from app.database import get_db
from app.schemas.pagination import PaginationParams
from app.models.event import Event
from app.models.user import User
from app.schemas.event import (
    EventCreate,
    EventListResponse,
    EventResponse,
    EventUpdate,
)

# Imported as a module rather than by name so calls read event_service.create,
# which keeps the layer visible at every call site - and stops the service
# functions from colliding with the route handlers, which want the same names.
from app.models.activity_log import ActivityAction, ActivityResource
from app.services import activity_log_service, event_service

router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


async def _get_for_editing(db: AsyncSession, event_id: UUID) -> Event:
    """Load an event for a caller who has already passed a permission gate.

    include_unpublished is True because drafts are hidden from the public, not
    from the people who write them. Every caller of this helper sits behind a
    require_permission dependency, so reaching here already means "allowed".
    """
    event = await event_service.get_event(db, event_id, include_unpublished=True)

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    return event


@router.get("", response_model=EventListResponse)
async def list_events(
    search: str | None = Query(None, max_length=100),
    upcoming: bool | None = Query(
        None, description="true for future events, false for past, omit for both"
    ),
    creator_id: UUID | None = None,
    include_drafts: bool = Query(
        False, description="Include unpublished events. Requires events.read."
    ),
    # Adopted late: these were two hand-written Query parameters with the same
    # names, caps and defaults. Identical on the wire, one place to change now.
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """The events list, serving the public page and the officials' table both.

    Anonymous callers are welcome; they simply see published events. The one
    thing that needs permission is include_drafts, which is the entire job of
    the events.read permission.
    """
    if include_drafts:
        assert_may_see_drafts(current_user, Permission.EVENTS_READ, noun="events")

    items, total = await event_service.list_events(
        db,
        search=search,
        include_unpublished=include_drafts,
        upcoming=upcoming,
        creator_id=creator_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    return EventListResponse(
        items=items, total=total, limit=pagination.limit, offset=pagination.offset
    )


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: UUID,
    current_user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """One event. A draft is 404 to anyone not allowed to see drafts.

    No flag here, unlike the list: with a single event there is nothing to page
    or filter, so the caller either may see it or may not.

    404 rather than 403 on purpose. 403 would confirm the event exists, which
    turns guessed IDs into a working way to enumerate unannounced events.
    """
    may_see_drafts = current_user is not None and current_user.can(
        Permission.EVENTS_READ
    )

    event = await event_service.get_event(
        db, event_id, include_unpublished=may_see_drafts
    )

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    return event


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate,
    _: CurrentUser = Depends(require_permission(Permission.EVENTS_CREATE)),
    author: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an event, attributed to the caller.

    Two auth dependencies, one token verification: FastAPI caches a dependency's
    result within a request, and both of these resolve through get_current_user.
    The gate answers "may you?", the second answers "who are you, in our tables?"

    The author is never read from the body. EventCreate has no field for it.
    """
    event = await event_service.create_event(db, payload, creator_id=author.id)

    # The audit seam this router was built with, now connected. One line, after
    # the work is done, and it cannot fail the request - see log_activity.
    #
    # The title travels in details because a log line has to stay readable when
    # the event it names has since been deleted or renamed. resource_id alone
    # would leave the reader with a UUID and nothing to recognise.
    await activity_log_service.log_activity(
        db,
        user_id=author.id,
        action=ActivityAction.CREATED,
        resource=ActivityResource.EVENT,
        resource_id=event.id,
        details={"title": event.title},
    )

    return event


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: UUID,
    payload: EventUpdate,
    _: CurrentUser = Depends(require_permission(Permission.EVENTS_UPDATE)),
    # Present only so the log knows who acted. It costs one SELECT, and that is
    # the honest price of logging in the router rather than the service - the
    # service is handed a plain UUID and stays free of any HTTP identity.
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit an event. Any official holding events.update may edit any event.

    OWNERSHIP HOOK - to restrict editing to the author instead, compare
    event.creator_id against actor.id below and 403 for a non-admin caller.
    Same block in delete_event. Nothing else changes.
    """
    event = await _get_for_editing(db, event_id)

    try:
        updated = await event_service.update_event(db, event, payload)
    except event_service.InvalidEventTimeRange as error:
        # A domain error becoming an HTTP one, at the only layer that knows
        # about both. The service stays usable from a script that has no
        # concept of a status code.
        raise HTTPException(
            status_code=422,
            detail={"reason": "invalid_time_range", "message": str(error)},
        ) from error

    # Only reached when the update succeeded. A rejected edit is not something
    # that happened, and logging it would fill the trail with non-events.
    await activity_log_service.log_activity(
        db,
        user_id=actor.id,
        action=ActivityAction.UPDATED,
        resource=ActivityResource.EVENT,
        resource_id=updated.id,
        details={"title": updated.title},
    )

    return updated


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: UUID,
    _: CurrentUser = Depends(require_permission(Permission.EVENTS_DELETE)),
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an event permanently. Returns no body - 204 says it plainly."""
    event = await _get_for_editing(db, event_id)

    # READ BEFORE THE DELETE, NOT AFTER.
    #
    # This is the one place the logging pattern cannot simply follow the
    # mutation. Once the row is gone, SQLAlchemy expires the instance and
    # reading event.title either raises or tries to reload a row that no longer
    # exists - so the details have to be captured while there is still
    # something to capture.
    #
    # It is also the case where details matter most: resource_id points at a
    # row nobody can look up any more, so the title in here is the only thing
    # that makes the line mean anything.
    details = {"title": event.title}
    event_id_for_log = event.id

    await event_service.delete_event(db, event)

    await activity_log_service.log_activity(
        db,
        user_id=actor.id,
        action=ActivityAction.DELETED,
        resource=ActivityResource.EVENT,
        resource_id=event_id_for_log,
        details=details,
    )
