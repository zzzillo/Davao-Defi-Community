import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, get_current_clerk_user, get_current_db_user
from app.database import get_db
from app.models.activity_log import ActivityAction, ActivityAudience, ActivityResource
from app.models.media_asset import MediaPurpose
from app.models.user import AccountStatus, User
from app.models.user_invitation import InvitationStatus
from app.schemas.blog import BlogListResponse
from app.schemas.pagination import PaginationParams
from app.schemas.user import (
    ContributorListResponse,
    ContributorResponse,
    UserProfileUpdate,
    UserResponse,
)
from app.services import activity_log_service, blog_service, user_service
from app.services.exceptions import PublicSlugAlreadyExists
from app.services import clerk_onboarding_service, clerk_service, invitation_service
from app.services.media_service import MediaReferenceError, validate_media_reference

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/sync", response_model=UserResponse)
async def sync_current_clerk_user(
    clerk_state=Depends(get_current_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    """Read the canonical Clerk identity after login and sync its local row."""
    clerk_user_id = clerk_state.payload.get("sub")
    try:
        provider_user = await clerk_service.get_clerk_user(clerk_user_id)
    except Exception as exc:
        logger.warning("Clerk identity sync could not fetch the current user")
        raise HTTPException(status_code=503, detail={"reason": "clerk_user_sync_unavailable"}) from exc

    provider_data = user_service._dict(provider_user)
    if provider_data.get("id") != clerk_user_id:
        raise HTTPException(status_code=503, detail={"reason": "clerk_user_sync_unavailable"})
    try:
        user, _ = await clerk_onboarding_service.synchronize_clerk_identity(db, provider_data)
        if user.clerk_deleted_at is not None:
            raise HTTPException(status_code=403, detail={"reason": "clerk_identity_deleted"})
        if user.status != AccountStatus.ACTIVE.value:
            raise HTTPException(status_code=403, detail={"reason": "account_suspended"})
        await db.commit()
        return user
    except user_service.UninvitedClerkUser as exc:
        await db.rollback()
        raise HTTPException(
            status_code=403,
            detail={"reason": "invitation_required", "message": "An active invitation is required to access this application."},
        ) from exc
    except invitation_service.InvitationNotAccepted as exc:
        # Provider state may have transitioned the local invitation to revoked
        # or expired immediately before raising this access denial.
        await db.commit()
        raise HTTPException(
            status_code=409,
            detail={"reason": "invitation_not_accepted", "message": "Accept your invitation before accessing this application."},
        ) from exc
    except invitation_service.InvitationProviderUnavailable as exc:
        await db.rollback()
        raise HTTPException(
            status_code=503,
            detail={"reason": "clerk_invitation_sync_unavailable"},
        ) from exc


@router.get("/me", response_model=UserResponse)
async def get_current_user(user: User = Depends(get_current_db_user)):
    return user


@router.patch("/me", response_model=UserResponse)
async def update_my_profile(
    payload: UserProfileUpdate,
    actor_snapshot: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    actor = await db.scalar(
        select(User)
        .where(User.id == actor_snapshot.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if actor is None or actor.status != AccountStatus.ACTIVE.value:
        raise HTTPException(status_code=403, detail={"reason": "account_suspended"})

    try:
        async with db.begin_nested():
            changes = payload.model_dump(exclude_unset=True)
            if "display_name" in changes and not (changes["display_name"] or "").strip():
                raise HTTPException(status_code=422, detail="display_name cannot be empty")
            if (
                "profile_photo_key" in changes
                and changes["profile_photo_key"] != actor.profile_photo_key
            ):
                try:
                    await validate_media_reference(
                        db,
                        changes["profile_photo_key"],
                        purpose=MediaPurpose.PROFILE_PHOTO,
                        owner_id=actor.id,
                    )
                except MediaReferenceError as error:
                    raise HTTPException(
                        status_code=422,
                        detail={"reason": error.reason},
                    ) from error

            if (
                actor.show_in_contributor_directory
                and "public_slug" in changes
                and changes["public_slug"] != actor.public_slug
            ):
                raise HTTPException(
                    status_code=409,
                    detail={
                        "reason": "public_slug_immutable",
                        "message": "A public contributor URL cannot change after publication.",
                    },
                )

            requested_slug = changes.pop("public_slug", ...)
            if requested_slug is not ...:
                if requested_slug is None:
                    actor.public_slug = None
                else:
                    try:
                        await user_service.set_public_slug(db, actor, requested_slug)
                    except PublicSlugAlreadyExists as error:
                        raise HTTPException(
                            status_code=409,
                            detail={"reason": "public_slug_taken", "slug": requested_slug},
                        ) from error

            for field, value in changes.items():
                setattr(actor, field, value)

            await db.flush()
            await activity_log_service.log_activity(
                db,
                user_id=actor.id,
                owner_id=actor.id,
                audience=ActivityAudience.USER_MANAGEMENT,
                action=ActivityAction.UPDATED_PROFILE,
                resource=ActivityResource.USER,
                resource_id=actor.id,
                details={"fields": sorted(payload.model_fields_set)},
            )
    except IntegrityError as error:
        raise HTTPException(status_code=409, detail={"reason": "profile_value_taken"}) from error
    await db.commit()
    return actor


@router.get("/contributors", response_model=ContributorListResponse)
async def list_contributors(
    search: str | None = Query(None, max_length=100),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    conditions = [
        User.show_in_contributor_directory.is_(True),
        User.status == AccountStatus.ACTIVE.value,
        User.public_slug.is_not(None),
    ]
    if search:
        term = f"%{search}%"
        conditions.append(or_(User.display_name.ilike(term), User.alias.ilike(term)))

    total = await db.scalar(
        select(func.count()).select_from(User).where(*conditions)
    )
    result = await db.execute(
        select(User)
        .where(*conditions)
        .order_by(User.contributor_directory_order.asc().nulls_last(), User.display_name, User.id)
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return ContributorListResponse(
        items=result.scalars().all(),
        total=total or 0,
        limit=pagination.limit,
        offset=pagination.offset,
    )


async def _public_contributor(db: AsyncSession, public_slug: str) -> User:
    user = await db.scalar(
        select(User).where(
            User.public_slug == public_slug,
            User.show_in_contributor_directory.is_(True),
            User.status == AccountStatus.ACTIVE.value,
        )
    )
    if user is None:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return user


@router.get("/contributors/{public_slug}", response_model=ContributorResponse)
async def get_contributor(public_slug: str, db: AsyncSession = Depends(get_db)):
    return await _public_contributor(db, public_slug)


@router.get("/contributors/{public_slug}/blogs", response_model=BlogListResponse)
async def list_contributor_blogs(
    public_slug: str,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    contributor = await _public_contributor(db, public_slug)
    items, total = await blog_service.list_blogs(
        db,
        include_unpublished=False,
        creator_id=contributor.id,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return BlogListResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )
