"""Recording what people did, and reading it back.

Two functions with very different contracts, which is the whole design of this
module:

- log_activity is called BY every other router. It must never raise, never
  interfere with the request that triggered it, and never become a reason a
  user's action fails.
- list_activity_logs is called BY the activity logs router, and behaves like
  every other list function in this project.

Nothing here imports FastAPI. log_activity takes a user_id rather than a
CurrentUser for exactly that reason - the router unwraps the HTTP identity and
hands over a plain UUID, so a seed script or a management command could call
this too.
"""

import json
import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity_log import ActivityAction, ActivityLog, ActivityResource

logger = logging.getLogger(__name__)

# A cap on the serialised details blob.
#
# details is meant to hold identifying scraps - a title, a role change, a name -
# not content. Without a limit, somebody logging a whole blog body would put a
# hundred kilobytes into a table that already grows forever, and would do it on
# every edit. Four kilobytes is far more than any legitimate entry needs.
MAX_DETAILS_BYTES = 4096

# ActivityLogResponse reads this. Declared once so no query can omit it - and
# the relationship is lazy="raise", so omitting it fails loudly rather than
# silently attempting IO at serialisation time.
RESPONSE_LOADERS = (selectinload(ActivityLog.user),)


def publish_action(was_published: bool, now_published: bool) -> ActivityAction:
    """Which action a PATCH really performed: an edit, a publish, or a retraction.

    Posts and blogs both have a published flag that a general-purpose PATCH can
    flip, so "was this an edit or a publication?" is a question only the route
    can answer - by comparing the value it read before the service ran against
    the value afterwards.

    Worth distinguishing because an admin scanning for "what went public today"
    should not have to open every `updated` entry to find out, and because
    unpublishing something is exactly the kind of quiet act an audit trail
    exists to surface.

    Written once here rather than twice in two routers, and pure - no session,
    no IO, nothing to mock.
    """
    if now_published and not was_published:
        return ActivityAction.PUBLISHED

    if was_published and not now_published:
        return ActivityAction.UNPUBLISHED

    return ActivityAction.UPDATED


def _validate_details(details: dict | None) -> dict | None:
    """Check the details blob is something worth storing, or raise.

    Three rules, and each exists because the database will not enforce it.
    JSONB accepts anything JSON-shaped, so these are the only guard there is.

    A dict, not a list or a bare value: every consumer reads details by key,
    and a list would have to be special-cased in the renderer forever.

    String keys, because JSON object keys are strings anyway - a dict with an
    int key silently becomes {"1": ...} on the way in, which then never matches
    a lookup written as details[1].

    JSON-serialisable, checked by actually serialising it. A datetime or a UUID
    left in the dict would raise inside SQLAlchemy at flush time, well away
    from the call site that caused it. Doing it here means the failure names
    the real culprit.

    Raises rather than returning a flag. Every caller is log_activity, which
    catches everything - so this stays simple and the swallowing happens in
    exactly one place.
    """
    if details is None:
        return None

    if not isinstance(details, dict):
        raise TypeError(f"details must be a dict, got {type(details).__name__}")

    for key in details:
        if not isinstance(key, str):
            raise TypeError(f"details keys must be strings, got {type(key).__name__}")

    encoded = json.dumps(details)

    if len(encoded.encode("utf-8")) > MAX_DETAILS_BYTES:
        raise ValueError(
            f"details is {len(encoded)} bytes, over the {MAX_DETAILS_BYTES} limit - "
            "log identifying scraps such as a title, not content"
        )

    return details


async def log_activity(
    db: AsyncSession,
    *,
    user_id: UUID | None,
    action: ActivityAction,
    resource: ActivityResource,
    resource_id: UUID | None = None,
    details: dict | None = None,
) -> ActivityLog | None:
    """Record one thing somebody did. Returns the row, or None if it failed.

    THIS FUNCTION MUST NEVER RAISE. That is its most important property and the
    reason for the bare except at the bottom.

    A route calls this after its own work has already been committed. If
    logging were allowed to fail the request, a hiccup in the audit table would
    refuse to save somebody's blog post - and losing an audit line is a smaller
    harm than losing an evening's writing. For a bank's ledger the opposite
    would be true; this is a community website.

    So a failure is swallowed and reported to the application log instead. The
    log line is the safety net: a broken audit trail shows up in the server log
    rather than disappearing quietly.

    Every argument after db is keyword-only. log_activity(db, uid, "deleted",
    "user", uid) reads as though it might mean anything, and the two UUIDs are
    exactly the pair worth being unable to transpose.

    It commits on its own, separately from the mutation that preceded it. That
    is the same decision from the other direction: sharing the mutation's
    transaction would let a log failure roll the mutation back.
    """
    try:
        # Coerced rather than trusted. Passing a bare string that is not in the
        # enum is a programming error, and this turns it into a loud line in
        # the log instead of a row nothing will ever match a filter against.
        action = ActivityAction(action)
        resource = ActivityResource(resource)

        entry = ActivityLog(
            user_id=user_id,
            action=action.value,
            resource=resource.value,
            resource_id=resource_id,
            details=_validate_details(details),
        )

        db.add(entry)
        await db.commit()

        return entry
    except Exception:
        # Deliberately broad. The contract is "never raise into a route", and a
        # narrower except would let some unanticipated failure through and take
        # a successful mutation's response down with it.
        logger.exception(
            "Failed to log activity: action=%s resource=%s resource_id=%s user=%s",
            action,
            resource,
            resource_id,
            user_id,
        )

        # The session is left usable for whatever the route does next. Without
        # this a failed flush would leave it in a state where every later query
        # raises, turning a lost log line into a broken response.
        await db.rollback()

        return None


async def list_activity_logs(
    db: AsyncSession,
    *,
    resource: ActivityResource | None = None,
    action: ActivityAction | None = None,
    user_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[ActivityLog], int]:
    """A page of log entries, newest first, plus how many matched.

    Newest first is not a preference here the way it is elsewhere - it is the
    only order an audit trail is ever read in, which is why created_at leads
    every index on the table.

    id breaks ties. Two entries written in the same microsecond - which one
    request emitting two logs can produce - would otherwise be free to swap
    places between pages: one shown twice, the other never.
    """
    conditions = []

    if resource is not None:
        conditions.append(ActivityLog.resource == resource.value)

    if action is not None:
        conditions.append(ActivityLog.action == action.value)

    if user_id is not None:
        conditions.append(ActivityLog.user_id == user_id)

    total = await db.scalar(
        select(func.count()).select_from(ActivityLog).where(*conditions)
    )

    result = await db.execute(
        select(ActivityLog)
        .options(*RESPONSE_LOADERS)
        .where(*conditions)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
        .limit(limit)
        .offset(offset)
    )

    return list(result.scalars().all()), total or 0
