from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.activity_log import ActivityAction, ActivityResource
from app.schemas.common import PublicUserResponse
from app.schemas.pagination import Page


class ActivityLogResponse(BaseModel):
    """One log entry on the way out.

    THE SHORTEST SCHEMA FILE IN THIS PROJECT, and the only one with no Create
    or Update model. Both would be meaningless: entries are written by
    log_activity from inside the application, never posted by a client, and an
    audit trail nobody can edit is the entire point of the table.

    Note what is NOT here: a sentence. The API sends action="created",
    resource="event" and lets the frontend render "RJ created Event". Storing
    "RJ created Event" instead would freeze the wording in English forever,
    make filtering by action a LIKE over prose, and go stale the day a role is
    renamed. One renderer changes once; ten thousand stored sentences do not
    change at all.

    Requires ActivityLog.user to be loaded. The relationship is lazy="raise",
    so a query that forgot the loader fails loudly here rather than attempting
    IO during serialisation.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID

    # Typed as the enums rather than as str, so the OpenAPI schema lists the
    # real vocabulary and a generated client gets a union instead of a string.
    action: ActivityAction
    resource: ActivityResource

    # Points at a row that may no longer exist - a delete log names what it
    # deleted. That is correct, and the frontend must not assume it can follow
    # this to a live page.
    resource_id: UUID | None

    # Whatever scraps make the line readable. Shape varies by action; see
    # models/activity_log.py.
    details: dict | None

    created_at: datetime

    # The slice of a user safe to show. Null only if the actor's row was
    # deleted, which no route in this codebase can currently do.
    user: PublicUserResponse | None


# The same page shape every module returns - see schemas/pagination.py.
ActivityLogListResponse = Page[ActivityLogResponse]
