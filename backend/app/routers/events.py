from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    CurrentUser,
    get_current_db_user,
    get_optional_user,
    require_permission,
)
from app.auth.permissions import Permission
from app.database import get_db
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
from app.services import event_service

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
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """The events list, serving the public page and the officials' table both.

    Anonymous callers are welcome; they simply see published events. The one
    thing that needs permission is include_drafts, which is the entire job of
    the events.read permission.
    """
    if include_drafts:
        # 401 and 403 answer different questions, and the frontend reacts to
        # each differently: unknown identity means send them to sign in, known
        # identity means show them why they were refused.
        if current_user is None:
            raise HTTPException(
                status_code=401,
                detail={
                    "reason": "authentication_required",
                    "message": "Sign in to view unpublished events",
                },
            )

        if not current_user.can(Permission.EVENTS_READ):
            raise HTTPException(
                status_code=403,
                detail={
                    "reason": "missing_permission",
                    "required_permission": Permission.EVENTS_READ.value,
                },
            )

    items, total = await event_service.list_events(
        db,
        search=search,
        include_unpublished=include_drafts,
        upcoming=upcoming,
        creator_id=creator_id,
        limit=limit,
        offset=offset,
    )

    return EventListResponse(items=items, total=total)


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
    return await event_service.create_event(db, payload, creator_id=author.id)


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: UUID,
    payload: EventUpdate,
    _: CurrentUser = Depends(require_permission(Permission.EVENTS_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """Edit an event. Any official holding events.update may edit any event.

    OWNERSHIP HOOK - to restrict editing to the author instead, add
    `author: User = Depends(get_current_db_user)` to this signature and, for a
    non-admin caller, 403 when event.creator_id != author.id. Same block in
    delete_event. Nothing else changes.
    """
    event = await _get_for_editing(db, event_id)

    try:
        return await event_service.update_event(db, event, payload)
    except event_service.InvalidEventTimeRange as error:
        # A domain error becoming an HTTP one, at the only layer that knows
        # about both. The service stays usable from a script that has no
        # concept of a status code.
        raise HTTPException(
            status_code=422,
            detail={"reason": "invalid_time_range", "message": str(error)},
        ) from error


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: UUID,
    _: CurrentUser = Depends(require_permission(Permission.EVENTS_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Delete an event permanently. Returns no body - 204 says it plainly."""
    event = await _get_for_editing(db, event_id)

    await event_service.delete_event(db, event)
