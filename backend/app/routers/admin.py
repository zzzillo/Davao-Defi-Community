from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    CurrentUser,
    get_current_db_user,
    require_admin,
    require_permission,
)
from app.auth.permissions import Permission, Role, role_at_least
from app.database import get_db
from app.models.activity_log import ActivityAction, ActivityResource
from app.models.user import User
from app.services import activity_log_service
from app.schemas.user import UserListResponse, UserResponse, UserRoleUpdate
from app.services.clerk_service import set_user_authorization
from app.services.user_service import apply_authorization_to_mirror

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)


@router.get("/ping")
async def admin_ping(
    current_user: CurrentUser = Depends(require_admin),
):
    """Smallest possible admin-only endpoint.

    The gate is the whole point: the body assumes it is talking to an admin
    because it cannot be reached any other way.
    """
    return {
        "ok": True,
        "clerk_user_id": current_user.clerk_user_id,
        "role": current_user.role,
    }


@router.get("/users", response_model=UserListResponse)
async def list_users(
    search: str | None = Query(None, max_length=100),
    role: Role | None = None,
    team_id: UUID | None = None,
    # Capped deliberately. An unbounded list endpoint is fine with 3 users and a
    # problem with 3000, and nobody notices the day it crosses over.
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: CurrentUser = Depends(require_permission(Permission.USERS_READ)),
    db: AsyncSession = Depends(get_db),
):
    """List users for the admin table, with search and filters applied in SQL.

    Every filter below reads the local mirror. This is the read path the mirror
    exists for - none of it is expressible against a JWT.
    """
    conditions = []

    if search:
        # Parameterised by SQLAlchemy, so the term is data, never SQL. A literal
        # % or _ typed by the user acts as a wildcard, which is harmless here.
        term = f"%{search}%"

        conditions.append(
            or_(
                User.display_name.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
            )
        )

    if role is not None:
        conditions.append(User.role == role.value)

    if team_id is not None:
        conditions.append(User.team_id == team_id)

    query = select(User)

    if conditions:
        query = query.where(*conditions)

    # Counted before paging, so the UI can say "showing 1-50 of 214".
    total = await db.scalar(select(func.count()).select_from(query.subquery()))

    result = await db.execute(
        # id breaks ties. Without a deterministic order, offset paging can show
        # the same row twice and skip another.
        query.order_by(User.display_name, User.id).limit(limit).offset(offset)
    )

    return UserListResponse(items=result.scalars().all(), total=total)


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    payload: UserRoleUpdate,
    # require_admin, never require_permission. Granting power is the one thing
    # that must not be delegable to a permission an admin could hand out.
    current_user: CurrentUser = Depends(require_admin),
    # The acting admin's local row, so the log can name them. current_user
    # carries a Clerk id; activity_logs.user_id is a foreign key into our own
    # users table, and those are different identifiers.
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's role and permissions.

    Writes Clerk first, then the local mirror, because Clerk is what the gates
    read. The schema has already rejected unknown roles and permission lists on
    roles that ignore them, so by this point the payload is known-good.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()

    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    if target.clerk_user_id == current_user.clerk_user_id:
        # Without this, the last admin can demote themselves and nobody can ever
        # reach this endpoint again. Blocking self-change is enough on its own:
        # another admin can still demote this one, so an admin always remains.
        raise HTTPException(
            status_code=403,
            detail={
                "reason": "cannot_change_own_role",
                "message": "Another admin must do this, or use scripts/set_role.py",
            },
        )

    # READ BEFORE THE WRITE. apply_authorization_to_mirror updates this same
    # row, so after it runs there is no "before" left anywhere to compare
    # against - and a role change log with no previous role is barely a log.
    #
    # permissions is copied rather than referenced: it is a mutable list on the
    # ORM object, and holding the reference would mean comparing the new value
    # against itself.
    previous_role = target.role
    previous_permissions = set(target.permissions or [])
    target_name = target.display_name
    target_id = target.id

    # Clerk first. If this raises, the line below never runs and the database
    # cannot end up announcing a promotion that Clerk refused.
    metadata = await set_user_authorization(
        target.clerk_user_id,
        payload.role,
        payload.permissions,
    )

    updated = await apply_authorization_to_mirror(db, target.clerk_user_id, metadata)

    if updated is None:
        # Unreachable in practice - the row was found by id moments ago - but
        # returning `target` here would hand the admin the pre-change values and
        # make a failed mirror write look like a success.
        raise HTTPException(status_code=500, detail="Mirror row vanished mid-update")

    # UP TO TWO ENTRIES FROM ONE REQUEST, and that is deliberate.
    #
    # This route changes a role and a permission list together, so a single
    # promotion can also be a permission grant. Folding both into one entry
    # would mean filtering by action=updated_permissions silently misses every
    # permission change that happened during a promotion - which is exactly the
    # kind of change an audit trail exists to surface.
    #
    # Emitted only when something actually changed. An admin who opens the form
    # and saves without editing anything has not done something worth recording.
    if updated.role != previous_role:
        await activity_log_service.log_activity(
            db,
            user_id=actor.id,
            # promoted or demoted, decided by rank rather than by a list of
            # pairs. role_at_least already knows the hierarchy, so a fourth role
            # would not need this line rewritten.
            action=(
                ActivityAction.PROMOTED
                if role_at_least(Role(updated.role), Role(previous_role))
                else ActivityAction.DEMOTED
            ),
            resource=ActivityResource.USER,
            resource_id=target_id,
            details={
                "display_name": target_name,
                "from": previous_role,
                "to": updated.role,
            },
        )

    current_permissions = set(updated.permissions or [])

    if current_permissions != previous_permissions:
        await activity_log_service.log_activity(
            db,
            user_id=actor.id,
            action=ActivityAction.UPDATED_PERMISSIONS,
            resource=ActivityResource.USER,
            resource_id=target_id,
            details={
                "display_name": target_name,
                # Sorted so two identical changes produce identical details,
                # and so a reader is not left diffing two unordered lists.
                "added": sorted(current_permissions - previous_permissions),
                "removed": sorted(previous_permissions - current_permissions),
            },
        )

    return updated
