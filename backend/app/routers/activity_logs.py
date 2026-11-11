from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_db_user
from app.auth.permissions import parse_role
from app.database import get_db
from app.models.activity_log import ActivityAction, ActivityResource
from app.schemas.activity_log import ActivityLogListResponse
from app.schemas.pagination import PaginationParams
from app.models.user import User

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
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """The audit trail, newest first.

    THE ONLY ROUTE IN THIS MODULE, and that is deliberate. There is no POST,
    because entries are written by log_activity from inside the application
    rather than posted by a client. There is no PATCH or DELETE, because a
    record somebody can edit is not a record.

    Available only to signed-in users and scoped by role: members see their own
    private work, officials also see shared work, and admins see permitted
    user-management entries. Superadmins see the full feed.

    The filters are typed as enums rather than strings, so FastAPI rejects
    ?resource=banana with a 422 naming the valid values before any query runs -
    and the OpenAPI schema documents the vocabulary for free.
    """
    items, total = await activity_log_service.list_activity_logs(
        db,
        resource=resource,
        action=action,
        user_id=user_id,
        viewer_id=actor.id,
        viewer_role=parse_role(actor.role),
        limit=pagination.limit,
        offset=pagination.offset,
    )

    return ActivityLogListResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )
