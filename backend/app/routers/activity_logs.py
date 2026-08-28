from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, require_permission
from app.auth.permissions import Permission
from app.database import get_db
from app.models.activity_log import ActivityAction, ActivityResource
from app.schemas.activity_log import ActivityLogListResponse
from app.schemas.pagination import PaginationParams

# Imported as a module rather than by name so calls read
# activity_log_service.list_activity_logs, which keeps the layer visible.
from app.services import activity_log_service

router = APIRouter(
    prefix="/activity-logs",
    tags=["Activity Logs"],
)


@router.get("", response_model=ActivityLogListResponse)
async def list_activity_logs(
    resource: ActivityResource | None = Query(
        None, description="Only entries about this kind of thing"
    ),
    action: ActivityAction | None = Query(None, description="Only this kind of action"),
    user_id: UUID | None = Query(None, description="Only what this person did"),
    pagination: PaginationParams = Depends(),
    _: CurrentUser = Depends(require_permission(Permission.ACTIVITY_LOGS_READ)),
    db: AsyncSession = Depends(get_db),
):
    """The audit trail, newest first.

    THE ONLY ROUTE IN THIS MODULE, and that is deliberate. There is no POST,
    because entries are written by log_activity from inside the application
    rather than posted by a client. There is no PATCH or DELETE, because a
    record somebody can edit is not a record.

    Gated rather than public, unlike every other list in this project. The
    other four serve published rows to anonymous visitors; this one describes
    who did what and when, which is exactly the shape of information that helps
    somebody work out how to attack an organisation. It needs
    activity_logs.read, and admins hold every permission implicitly.

    The filters are typed as enums rather than strings, so FastAPI rejects
    ?resource=banana with a 422 naming the valid values before any query runs -
    and the OpenAPI schema documents the vocabulary for free.
    """
    items, total = await activity_log_service.list_activity_logs(
        db,
        resource=resource,
        action=action,
        user_id=user_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    return ActivityLogListResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )
