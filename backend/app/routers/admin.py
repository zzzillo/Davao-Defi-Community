from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, get_current_db_user, get_current_user, require_admin, require_permission
from app.auth.permissions import Permission, Role, parse_role, role_at_least
from app.auth.locks import USER_MUTATION_LOCK_KEY
from app.database import get_db
from app.models.activity_log import (
    ActivityAction,
    ActivityAudience,
    ActivityResource,
    ActivityLog,
)
from app.models.media_asset import MediaPurpose
from app.models.blog import Blog
from app.models.event import Event
from app.models.partner import Partner
from app.models.post import Post
from app.models.user import AccountStatus, User
from app.models.user_invitation import InvitationStatus, UserInvitation
from app.schemas.activity_log import ActivityLogResponse
from app.schemas.blog import BlogListResponse, BlogResponse
from app.schemas.event import EventListResponse, EventResponse
from app.schemas.pagination import PaginationParams
from app.schemas.partner import PartnerListResponse, PartnerResponse
from app.schemas.post import PostListResponse, PostResponse
from app.schemas.user import (
    AdminUserProfileAndDirectoryUpdate,
    UserDirectoryUpdate,
    InvitationCreate,
    InvitationListResponse,
    InvitationResponse,
    UserListResponse,
    UserProfileUpdate,
    UserResponse,
    UserRoleUpdate,
    UserStatusUpdate,
)
from app.services import activity_log_service, blog_service, event_service, invitation_service, partner_service, post_service, user_service
from app.services.exceptions import PublicSlugAlreadyExists
from app.services.media_service import MediaReferenceError, validate_media_reference
from app.security.rate_limits import limit_admin

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(limit_admin)])


def _scope_blog_creator(role: Role, actor_id: UUID, requested: UUID | None) -> tuple[UUID | None, bool]:
    """Intersect creator filters with the caller's blog visibility scope."""
    if role is Role.SUPERADMIN:
        return requested, True
    if requested is not None and requested != actor_id:
        return actor_id, False
    return actor_id, True


def _user_scope(role: Role):
    if role is Role.SUPERADMIN:
        return True
    return User.role.in_([Role.MEMBER.value, Role.OFFICIAL.value, Role.ADMIN.value])


async def _lock_and_reload_users(
    db: AsyncSession,
    actor_id: UUID,
    target_id: UUID,
) -> tuple[User, User]:
    """Serialize access changes and re-check current actor authority in SQL."""
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:lock_key)"),
        {"lock_key": USER_MUTATION_LOCK_KEY},
    )
    actor = await db.scalar(
        select(User)
        .where(User.id == actor_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    target = await db.scalar(
        select(User)
        .where(User.id == target_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if actor is None or actor.status != AccountStatus.ACTIVE.value:
        raise HTTPException(status_code=403, detail={"reason": "inactive_actor"})
    if not role_at_least(parse_role(actor.role), Role.ADMIN):
        raise HTTPException(status_code=403, detail={"reason": "admin_required"})
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    return actor, target


async def _set_directory_order(
    db: AsyncSession,
    target: User,
    requested_order: int | None,
) -> None:
    """Insert a contributor at a valid one-based position and shift peers."""
    if requested_order is None:
        if target.contributor_directory_order is None:
            return
        peers = list((await db.scalars(
            select(User)
            .where(
                User.id != target.id,
                User.show_in_contributor_directory.is_(True),
            )
            .order_by(User.contributor_directory_order, User.display_name, User.id)
            .with_for_update()
        )).all())
        target.contributor_directory_order = None
        for order, user in enumerate(peers, start=1):
            user.contributor_directory_order = order
        return

    peers = list((await db.scalars(
        select(User)
        .where(
            User.id != target.id,
            User.show_in_contributor_directory.is_(True),
        )
        .order_by(User.contributor_directory_order, User.display_name, User.id)
        .with_for_update()
    )).all())
    maximum = len(peers) + 1
    if requested_order > maximum:
        raise HTTPException(
            status_code=422,
            detail={
                "reason": "directory_order_too_high",
                "max": maximum,
                "message": f"Contributor directory order cannot exceed {maximum}.",
            },
        )

    peers.insert(requested_order - 1, target)
    for order, user in enumerate(peers, start=1):
        user.contributor_directory_order = order


async def _lock_and_reload_invitation_actor(
    db: AsyncSession,
    actor_id: UUID,
    assigned_role: Role | None = None,
) -> User:
    """Serialize invitation writes with role changes and verify live authority."""
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:lock_key)"),
        {"lock_key": USER_MUTATION_LOCK_KEY},
    )
    actor = await db.scalar(
        select(User)
        .where(User.id == actor_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if actor is None or actor.status != AccountStatus.ACTIVE.value or actor.clerk_deleted_at is not None:
        raise HTTPException(status_code=403, detail={"reason": "inactive_actor"})
    actor_role = parse_role(actor.role)
    if not role_at_least(actor_role, Role.ADMIN):
        raise HTTPException(status_code=403, detail={"reason": "admin_required"})
    if actor_role is Role.ADMIN and assigned_role is not None and assigned_role not in {Role.MEMBER, Role.OFFICIAL}:
        raise HTTPException(status_code=403, detail={"reason": "target_role_restricted"})
    return actor


def _check_invitation_scope(actor: User, invitation: UserInvitation) -> None:
    if parse_role(actor.role) is Role.ADMIN and invitation.assigned_role not in {
        Role.MEMBER.value,
        Role.OFFICIAL.value,
    }:
        raise HTTPException(status_code=403, detail={"reason": "target_role_restricted"})


def _check_admin_target(actor: User, target: User) -> Role:
    actor_role = parse_role(actor.role)
    target_role = parse_role(target.role)
    if target.id == actor.id:
        raise HTTPException(status_code=403, detail={"reason": "cannot_manage_own_access"})
    if actor_role is Role.ADMIN and target_role not in {Role.MEMBER, Role.OFFICIAL}:
        raise HTTPException(status_code=403, detail={"reason": "target_role_restricted"})
    return actor_role


@router.get("/ping")
async def admin_ping(current_user: CurrentUser = Depends(require_admin)):
    return {"ok": True, "clerk_user_id": current_user.clerk_user_id, "role": current_user.role}


@router.get("/dashboard")
async def dashboard(
    current_user: CurrentUser = Depends(get_current_user),
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    role = current_user.role
    blog_filter = [] if role is Role.SUPERADMIN else [Blog.creator_id == actor.id]
    blog_total = await db.scalar(select(func.count()).select_from(Blog).where(*blog_filter))
    blog_drafts = await db.scalar(
        select(func.count()).select_from(Blog).where(*blog_filter, Blog.published.is_(False))
    )
    totals: dict[str, int] = {
        "blogs": blog_total or 0,
        "blog_drafts": blog_drafts or 0,
    }

    if role_at_least(role, Role.OFFICIAL):
        totals.update(
            events=await db.scalar(select(func.count()).select_from(Event)) or 0,
            event_drafts=await db.scalar(
                select(func.count()).select_from(Event).where(Event.published.is_(False))
            ) or 0,
            posts=await db.scalar(select(func.count()).select_from(Post)) or 0,
            post_drafts=await db.scalar(
                select(func.count()).select_from(Post).where(Post.published.is_(False))
            ) or 0,
            partners=await db.scalar(select(func.count()).select_from(Partner)) or 0,
        )

    if role_at_least(role, Role.ADMIN):
        user_filter = [] if role is Role.SUPERADMIN else [
            User.role.in_([Role.MEMBER.value, Role.OFFICIAL.value, Role.ADMIN.value])
        ]
        totals["users"] = await db.scalar(
            select(func.count()).select_from(User).where(*user_filter)
        ) or 0
        totals["contributors"] = await db.scalar(
            select(func.count()).select_from(User).where(User.show_in_contributor_directory.is_(True))
        ) or 0
    recent, activity_total = await activity_log_service.list_activity_logs(
        db,
        viewer_id=actor.id,
        viewer_role=role,
        limit=10,
        offset=0,
    )
    if role_at_least(role, Role.ADMIN):
        totals["activity"] = activity_total
    return {
        "role": role.value,
        "totals": totals,
        "recent_work": [ActivityLogResponse.model_validate(item) for item in recent],
    }


@router.get("/blogs", response_model=BlogListResponse)
async def management_blogs(
    search: str | None = Query(None, max_length=100),
    creator_id: UUID | None = None,
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser = Depends(get_current_user),
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    scoped_creator, visible = _scope_blog_creator(current_user.role, actor.id, creator_id)
    if not visible:
        items, total = [], 0
    else:
        items, total = await blog_service.list_blogs(
            db,
            search=search,
            include_unpublished=True,
            creator_id=scoped_creator,
            limit=pagination.limit,
            offset=pagination.offset,
        )
    return BlogListResponse(items=items, total=total, limit=pagination.limit, offset=pagination.offset)


@router.get("/blogs/{blog_id}", response_model=BlogResponse)
async def management_blog_detail(
    blog_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    blog = await blog_service.get_blog(db, blog_id, include_unpublished=True)
    if blog is None or (current_user.role is not Role.SUPERADMIN and blog.creator_id != actor.id):
        raise HTTPException(status_code=404, detail="Blog not found")
    return blog


@router.get("/events", response_model=EventListResponse)
async def management_events(
    search: str | None = Query(None, max_length=100),
    upcoming: bool | None = None,
    creator_id: UUID | None = None,
    pagination: PaginationParams = Depends(),
    _: CurrentUser = Depends(require_permission(Permission.EVENTS_READ)),
    db: AsyncSession = Depends(get_db),
):
    items, total = await event_service.list_events(
        db, search=search, include_unpublished=True, upcoming=upcoming,
        creator_id=creator_id, limit=pagination.limit, offset=pagination.offset,
    )
    return EventListResponse(items=items, total=total, limit=pagination.limit, offset=pagination.offset)


@router.get("/events/{event_id}", response_model=EventResponse)
async def management_event_detail(
    event_id: UUID,
    _: CurrentUser = Depends(require_permission(Permission.EVENTS_READ)),
    db: AsyncSession = Depends(get_db),
):
    event = await event_service.get_event(db, event_id, include_unpublished=True)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.get("/posts", response_model=PostListResponse)
async def management_posts(
    search: str | None = Query(None, max_length=100),
    event_id: UUID | None = None,
    creator_id: UUID | None = None,
    pagination: PaginationParams = Depends(),
    _: CurrentUser = Depends(require_permission(Permission.POSTS_READ)),
    db: AsyncSession = Depends(get_db),
):
    items, total = await post_service.list_posts(
        db, search=search, include_unpublished=True, creator_id=creator_id,
        event_id=event_id, limit=pagination.limit, offset=pagination.offset,
    )
    return PostListResponse(items=items, total=total, limit=pagination.limit, offset=pagination.offset)


@router.get("/posts/{post_id}", response_model=PostResponse)
async def management_post_detail(
    post_id: UUID,
    _: CurrentUser = Depends(require_permission(Permission.POSTS_READ)),
    db: AsyncSession = Depends(get_db),
):
    post = await post_service.get_post(db, post_id, include_unpublished=True)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.get("/partners", response_model=PartnerListResponse)
async def management_partners(
    search: str | None = Query(None, max_length=100),
    pagination: PaginationParams = Depends(),
    _: CurrentUser = Depends(require_permission(Permission.PARTNERS_READ)),
    db: AsyncSession = Depends(get_db),
):
    items, total = await partner_service.list_partners(
        db, search=search, limit=pagination.limit, offset=pagination.offset
    )
    return PartnerListResponse(items=items, total=total, limit=pagination.limit, offset=pagination.offset)


@router.get("/partners/{partner_id}", response_model=PartnerResponse)
async def management_partner_detail(
    partner_id: UUID,
    _: CurrentUser = Depends(require_permission(Permission.PARTNERS_READ)),
    db: AsyncSession = Depends(get_db),
):
    partner = await partner_service.get_partner(db, partner_id)
    if partner is None:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner


@router.get("/users", response_model=UserListResponse)
async def list_users(
    search: str | None = Query(None, max_length=100),
    role: Role | None = None,
    team_id: UUID | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(require_permission(Permission.USERS_READ)),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if current_user.role is not Role.SUPERADMIN:
        conditions.append(User.role.in_([Role.MEMBER.value, Role.OFFICIAL.value, Role.ADMIN.value]))
    if search:
        term = f"%{search}%"
        conditions.append(or_(User.display_name.ilike(term), User.first_name.ilike(term), User.last_name.ilike(term)))
    if role is not None:
        conditions.append(User.role == role.value)
    if team_id is not None:
        conditions.append(User.team_id == team_id)
    query = select(User).where(*conditions)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(User.display_name, User.id).limit(limit).offset(offset))
    directory_order_count = await db.scalar(
        select(func.count()).select_from(User).where(User.show_in_contributor_directory.is_(True))
    )
    return UserListResponse(
        items=result.scalars().all(),
        total=total or 0,
        directory_order_count=directory_order_count or 0,
    )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: CurrentUser = Depends(require_permission(Permission.USERS_READ)),
    db: AsyncSession = Depends(get_db),
):
    conditions = [User.id == user_id]
    if current_user.role is not Role.SUPERADMIN:
        conditions.append(_user_scope(current_user.role))
    user = await db.scalar(select(User).where(*conditions))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    payload: UserRoleUpdate,
    _: CurrentUser = Depends(require_admin),
    actor_snapshot: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    actor, target = await _lock_and_reload_users(db, actor_snapshot.id, user_id)
    actor_role = _check_admin_target(actor, target)
    target_role = parse_role(target.role)
    if actor_role is Role.ADMIN and payload.role not in {Role.MEMBER, Role.OFFICIAL}:
        raise HTTPException(status_code=403, detail={"reason": "target_role_restricted"})

    previous_role = target_role
    if payload.role != target_role:
        active_superadmins = await db.scalar(
            select(func.count()).select_from(User).where(
                User.role == Role.SUPERADMIN.value,
                User.status == AccountStatus.ACTIVE.value,
            )
        ) or 0
        if (
            target_role is Role.SUPERADMIN
            and target.status == AccountStatus.ACTIVE.value
            and payload.role is not Role.SUPERADMIN
            and active_superadmins <= 1
        ):
            raise HTTPException(status_code=409, detail={"reason": "last_active_superadmin"})

        target.role = payload.role.value
        target.permissions = []
        await db.flush()
        await activity_log_service.log_activity(
            db,
            user_id=actor.id,
            owner_id=target.id,
            audience=ActivityAudience.USER_MANAGEMENT,
            action=(ActivityAction.PROMOTED if role_at_least(payload.role, previous_role) else ActivityAction.DEMOTED),
            resource=ActivityResource.USER,
            resource_id=target.id,
            details={"display_name": target.display_name, "from": previous_role.value, "to": payload.role.value},
        )
        await db.commit()
    return target


@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: UUID,
    payload: UserStatusUpdate,
    _: CurrentUser = Depends(require_admin),
    actor_snapshot: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    actor, target = await _lock_and_reload_users(db, actor_snapshot.id, user_id)
    _check_admin_target(actor, target)
    if payload.status is AccountStatus.ACTIVE and target.clerk_deleted_at is not None:
        raise HTTPException(status_code=409, detail={"reason": "clerk_identity_deleted"})
    previous = target.status
    if payload.status.value != previous:
        if (
            target.role == Role.SUPERADMIN.value
            and previous == AccountStatus.ACTIVE.value
            and payload.status is AccountStatus.SUSPENDED
        ):
            active_superadmins = await db.scalar(
                select(func.count()).select_from(User).where(
                    User.role == Role.SUPERADMIN.value,
                    User.status == AccountStatus.ACTIVE.value,
                )
            ) or 0
            if active_superadmins <= 1:
                raise HTTPException(status_code=409, detail={"reason": "last_active_superadmin"})
        target.status = payload.status.value
        await db.flush()
        await activity_log_service.log_activity(
            db,
            user_id=actor.id,
            owner_id=target.id,
            audience=ActivityAudience.USER_MANAGEMENT,
            action=(ActivityAction.SUSPENDED if payload.status is AccountStatus.SUSPENDED else ActivityAction.REACTIVATED),
            resource=ActivityResource.USER,
            resource_id=target.id,
            details={"display_name": target.display_name, "from": previous, "to": payload.status.value},
        )
        await db.commit()
    return target


@router.get("/invitations", response_model=InvitationListResponse)
async def list_invitations(
    status_filter: InvitationStatus | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(require_permission(Permission.USERS_READ)),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if current_user.role is not Role.SUPERADMIN:
        conditions.append(UserInvitation.assigned_role.in_([Role.MEMBER.value, Role.OFFICIAL.value]))
    if status_filter is not None:
        conditions.append(UserInvitation.status == status_filter.value)
    total = await db.scalar(
        select(func.count()).select_from(UserInvitation).where(*conditions)
    )
    result = await db.execute(
        select(UserInvitation)
        .where(*conditions)
        .order_by(UserInvitation.created_at.desc(), UserInvitation.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return InvitationListResponse(items=result.scalars().all(), total=total or 0)


@router.post(
    "/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    payload: InvitationCreate,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    actor_snapshot: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    if idempotency_key is not None:
        idempotency_key = idempotency_key.strip()
        if not idempotency_key or len(idempotency_key) > 128:
            raise HTTPException(status_code=422, detail={"reason": "invalid_idempotency_key"})
    actor = await _lock_and_reload_invitation_actor(db, actor_snapshot.id, payload.role)

    invitation = None
    if idempotency_key:
        invitation = await db.scalar(
            select(UserInvitation)
            .where(
                UserInvitation.invited_by_user_id == actor.id,
                UserInvitation.idempotency_key == idempotency_key,
            )
            .with_for_update()
        )
        if invitation and (
            invitation.email != payload.email or invitation.assigned_role != payload.role.value
        ):
            raise HTTPException(status_code=409, detail={"reason": "idempotency_key_reused"})

    if invitation is None:
        existing_user = await db.scalar(
            select(User.id).where(User.email == payload.email).limit(1)
        )
        if existing_user is not None:
            raise HTTPException(status_code=409, detail={"reason": "user_already_exists"})
        now = datetime.now(timezone.utc)
        try:
            accepted_invitation = await invitation_service.accepted_expired_invitation_for_email(
                db, payload.email
            )
        except invitation_service.InvitationProviderUnavailable as exc:
            raise HTTPException(
                status_code=503,
                detail={"reason": "clerk_invitation_sync_unavailable"},
            ) from exc
        if accepted_invitation is not None:
            raise HTTPException(status_code=409, detail={"reason": "active_invitation_exists"})
        existing_invitation = await db.scalar(
            select(UserInvitation)
            .where(
                UserInvitation.email == payload.email,
                or_(
                    UserInvitation.status == InvitationStatus.ACCEPTED.value,
                    and_(
                        UserInvitation.status.in_(
                            (InvitationStatus.PENDING.value, InvitationStatus.FAILED.value)
                        ),
                        (UserInvitation.expires_at.is_(None) | (UserInvitation.expires_at > now)),
                    ),
                ),
            )
            .limit(1)
            .with_for_update()
        )
        if existing_invitation is not None:
            raise HTTPException(status_code=409, detail={"reason": "active_invitation_exists"})
        invitation = UserInvitation(
            email=payload.email,
            assigned_role=payload.role.value,
            profile_details=(
                payload.profile_details.model_dump(exclude_unset=True, exclude_none=True)
                if payload.profile_details is not None
                else None
            ),
            invited_by_user_id=actor.id,
            idempotency_key=idempotency_key,
            status=InvitationStatus.PENDING.value,
            expires_at=now + invitation_service.INVITATION_TTL,
        )
        db.add(invitation)
        await db.flush()
        await activity_log_service.log_activity(
            db,
            user_id=actor.id,
            owner_id=actor.id,
            audience=ActivityAudience.USER_MANAGEMENT,
            action=ActivityAction.CREATED,
            resource=ActivityResource.USER,
            resource_id=invitation.id,
            details={
                "invitation_id": str(invitation.id),
                "assigned_role": payload.role.value,
                "lifecycle": InvitationStatus.PENDING.value,
            },
        )
        await db.commit()

    try:
        invitation = await invitation_service.deliver_invitation(
            db, invitation, actor_id=actor.id
        )
    except invitation_service.InvitationActorUnauthorized as exc:
        raise HTTPException(status_code=403, detail={"reason": "admin_required"}) from exc
    except invitation_service.InvitationDeliveryUncertain as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "reason": "invitation_delivery_uncertain",
                "invitation_id": str(invitation.id),
                "status": invitation.status,
            },
        ) from exc
    if invitation.status in {InvitationStatus.REVOKED.value, InvitationStatus.EXPIRED.value}:
        raise HTTPException(
            status_code=409,
            detail={"reason": "invitation_not_deliverable", "status": invitation.status},
        )
    return invitation


@router.post("/invitations/{invitation_id}/retry", response_model=InvitationResponse)
async def retry_invitation(
    invitation_id: UUID,
    actor_snapshot: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    actor = await _lock_and_reload_invitation_actor(db, actor_snapshot.id)
    invitation = await db.scalar(
        select(UserInvitation)
        .where(UserInvitation.id == invitation_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    _check_invitation_scope(actor, invitation)
    try:
        invitation = await invitation_service.deliver_invitation(
            db, invitation, actor_id=actor.id
        )
    except invitation_service.InvitationActorUnauthorized as exc:
        raise HTTPException(status_code=403, detail={"reason": "admin_required"}) from exc
    except invitation_service.InvitationDeliveryUncertain as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "reason": "invitation_delivery_uncertain",
                "invitation_id": str(invitation.id),
                "status": invitation.status,
            },
        ) from exc
    if invitation.status in {InvitationStatus.REVOKED.value, InvitationStatus.EXPIRED.value}:
        raise HTTPException(status_code=409, detail={"reason": "invitation_not_deliverable", "status": invitation.status})
    return invitation


@router.post("/invitations/{invitation_id}/revoke", response_model=InvitationResponse)
async def revoke_invitation(
    invitation_id: UUID,
    actor_snapshot: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    actor = await _lock_and_reload_invitation_actor(db, actor_snapshot.id)
    invitation = await db.scalar(
        select(UserInvitation)
        .where(UserInvitation.id == invitation_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    _check_invitation_scope(actor, invitation)
    try:
        return await invitation_service.revoke_invitation(
            db, invitation, actor_id=actor.id
        )
    except invitation_service.InvitationActorUnauthorized as exc:
        raise HTTPException(status_code=403, detail={"reason": "admin_required"}) from exc
    except invitation_service.InvitationAlreadyAccepted as exc:
        raise HTTPException(
            status_code=409,
            detail={"reason": "invitation_already_accepted", "message": "Suspend the account through user management."},
        ) from exc
    except invitation_service.InvitationRevocationUncertain as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "reason": "invitation_revocation_uncertain",
                "invitation_id": str(invitation.id),
                "status": invitation.status,
            },
        ) from exc


async def _apply_profile_changes(db: AsyncSession, user: User, payload: UserProfileUpdate) -> list[str]:
    changes = payload.model_dump(exclude_unset=True)
    if "display_name" in changes and not (changes["display_name"] or "").strip():
        raise HTTPException(status_code=422, detail="display_name cannot be empty")
    if (
        "profile_photo_key" in changes
        and changes["profile_photo_key"] != user.profile_photo_key
    ):
        try:
            await validate_media_reference(
                db,
                changes["profile_photo_key"],
                purpose=MediaPurpose.PROFILE_PHOTO,
                owner_id=user.id,
            )
        except MediaReferenceError as error:
            raise HTTPException(status_code=422, detail={"reason": error.reason}) from error
    requested_slug = changes.pop("public_slug", ...)
    if requested_slug is not ...:
        if user.show_in_contributor_directory and requested_slug != user.public_slug:
            raise HTTPException(status_code=409, detail={"reason": "public_slug_immutable"})
        if requested_slug is None:
            user.public_slug = None
        else:
            try:
                await user_service.set_public_slug(db, user, requested_slug)
            except PublicSlugAlreadyExists as error:
                raise HTTPException(status_code=409, detail={"reason": "public_slug_taken"}) from error
    for field, value in changes.items():
        setattr(user, field, value)
    return sorted(payload.model_fields_set)


@router.patch("/users/{user_id}/profile", response_model=UserResponse)
async def update_user_profile(
    user_id: UUID,
    payload: UserProfileUpdate,
    _: CurrentUser = Depends(require_admin),
    actor_snapshot: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    actor, target = await _lock_and_reload_users(db, actor_snapshot.id, user_id)
    actor_role = parse_role(actor.role)
    if actor_role is Role.ADMIN and parse_role(target.role) is Role.SUPERADMIN:
        raise HTTPException(status_code=403, detail={"reason": "target_role_restricted"})
    try:
        async with db.begin_nested():
            fields = await _apply_profile_changes(db, target, payload)
            await db.flush()
            await activity_log_service.log_activity(
                db,
                user_id=actor.id,
                owner_id=target.id,
                audience=ActivityAudience.USER_MANAGEMENT,
                action=ActivityAction.UPDATED_PROFILE,
                resource=ActivityResource.USER,
                resource_id=target.id,
                details={"display_name": target.display_name, "fields": fields},
            )
    except IntegrityError as error:
        await db.rollback()
        raise HTTPException(status_code=409, detail={"reason": "profile_value_taken"}) from error
    await db.commit()
    return target


@router.patch("/users/{user_id}/profile-and-directory", response_model=UserResponse)
async def update_user_profile_and_directory(
    user_id: UUID,
    payload: AdminUserProfileAndDirectoryUpdate,
    _: CurrentUser = Depends(require_admin),
    actor_snapshot: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Save an account's profile and contributor-directory settings atomically."""
    actor, target = await _lock_and_reload_users(db, actor_snapshot.id, user_id)
    actor_role = parse_role(actor.role)
    if actor_role is Role.ADMIN and parse_role(target.role) is Role.SUPERADMIN:
        raise HTTPException(status_code=403, detail={"reason": "target_role_restricted"})

    try:
        async with db.begin_nested():
            profile_values = payload.model_dump(
                include=set(UserProfileUpdate.model_fields),
                exclude_unset=True,
            )
            profile_payload = UserProfileUpdate.model_validate(profile_values)
            profile_fields = await _apply_profile_changes(db, target, profile_payload)

            if payload.show_in_contributor_directory and target.public_slug is None:
                # Generate the public URL after applying a possible display-name
                # edit so the first slug reflects the saved profile.
                await user_service.set_public_slug(db, target, None)
            target.positions = payload.positions
            target.show_in_contributor_directory = payload.show_in_contributor_directory
            await _set_directory_order(db, target, payload.contributor_directory_order)

            await db.flush()
            await activity_log_service.log_activity(
                db,
                user_id=actor.id,
                owner_id=target.id,
                audience=ActivityAudience.USER_MANAGEMENT,
                action=ActivityAction.UPDATED_PROFILE,
                resource=ActivityResource.USER,
                resource_id=target.id,
                details={"display_name": target.display_name, "fields": profile_fields},
            )
            await activity_log_service.log_activity(
                db,
                user_id=actor.id,
                owner_id=target.id,
                audience=ActivityAudience.USER_MANAGEMENT,
                action=ActivityAction.UPDATED_DIRECTORY,
                resource=ActivityResource.USER,
                resource_id=target.id,
                details={"display_name": target.display_name},
            )
    except IntegrityError as error:
        await db.rollback()
        raise HTTPException(status_code=409, detail={"reason": "profile_value_taken"}) from error

    await db.commit()
    return target


@router.patch("/users/{user_id}/directory", response_model=UserResponse)
async def update_user_directory(
    user_id: UUID,
    payload: UserDirectoryUpdate,
    _: CurrentUser = Depends(require_admin),
    actor_snapshot: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    actor, target = await _lock_and_reload_users(db, actor_snapshot.id, user_id)
    actor_role = parse_role(actor.role)
    if actor_role is Role.ADMIN and parse_role(target.role) is Role.SUPERADMIN:
        raise HTTPException(status_code=403, detail={"reason": "target_role_restricted"})
    if payload.show_in_contributor_directory and target.public_slug is None:
        await user_service.set_public_slug(db, target, None)
    target.positions = payload.positions
    target.show_in_contributor_directory = payload.show_in_contributor_directory
    await _set_directory_order(db, target, payload.contributor_directory_order)
    await db.flush()
    await activity_log_service.log_activity(
        db,
        user_id=actor.id,
        owner_id=target.id,
        audience=ActivityAudience.USER_MANAGEMENT,
        action=ActivityAction.UPDATED_DIRECTORY,
        resource=ActivityResource.USER,
        resource_id=target.id,
        details={"display_name": target.display_name},
    )
    await db.commit()
    return target
