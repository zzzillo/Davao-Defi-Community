"""Database-authoritative onboarding for identities verified by Clerk."""

from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.locks import USER_MUTATION_LOCK_KEY
from app.models.activity_log import ActivityAction, ActivityAudience, ActivityResource
from app.models.user import User
from app.models.user_invitation import InvitationStatus
from app.services import activity_log_service, invitation_service, user_service


async def synchronize_clerk_identity(
    db: AsyncSession,
    clerk_user: dict,
    *,
    event_at: datetime | None = None,
) -> tuple[User, bool]:
    """Create from a provider-accepted local invite or refresh known identity.

    The caller supplies a canonical user object fetched from Clerk's Backend
    API. The database row owns role, status, and profile data. The shared lock
    serializes this transaction with access changes and last-superadmin guards.
    """
    clerk_user = user_service._dict(clerk_user)
    clerk_user_id = clerk_user.get("id")
    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        raise user_service.UninvitedClerkUser

    await db.execute(
        text("SELECT pg_advisory_xact_lock(:lock_key)"),
        {"lock_key": USER_MUTATION_LOCK_KEY},
    )
    existing = await db.scalar(
        select(User)
        .where(User.clerk_user_id == clerk_user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if existing is not None:
        user, created = await user_service.upsert_user_from_clerk(
            db,
            clerk_user,
            event_at=event_at,
        )
        return user, created

    email = user_service.verified_primary_email(clerk_user)
    if email is None:
        raise user_service.UninvitedClerkUser
    invitation = await invitation_service.latest_eligible_invitation_for_email(db, email)
    if invitation is None:
        raise user_service.UninvitedClerkUser
    if invitation.status not in {
        InvitationStatus.PENDING.value,
        InvitationStatus.ACCEPTED.value,
        InvitationStatus.FAILED.value,
    }:
        raise user_service.UninvitedClerkUser
    if invitation.accepted_clerk_user_id not in (None, clerk_user_id):
        raise user_service.UninvitedClerkUser

    # A Clerk user-created event alone does not prove invitation acceptance.
    # Require the exact provider invitation id to be in its accepted state.
    provider_invitation = await invitation_service.accepted_provider_invitation(invitation)
    if invitation.status in {InvitationStatus.REVOKED.value, InvitationStatus.EXPIRED.value}:
        raise user_service.UninvitedClerkUser
    invitation.status = InvitationStatus.ACCEPTED.value
    invitation.accepted_at = invitation.accepted_at or datetime.now(timezone.utc)
    invitation.accepted_clerk_user_id = clerk_user_id
    provider_expiry = invitation_service._provider_date(
        invitation_service._value(provider_invitation, "expires_at")
    )
    if provider_expiry is not None:
        invitation.expires_at = provider_expiry

    user, created = await user_service.upsert_user_from_clerk(
        db,
        clerk_user,
        invitation=invitation,
        event_at=event_at,
    )
    if created:
        # Invitation acceptance runs under USER_MUTATION_LOCK_KEY, so this
        # assigns a unique next number without renumbering existing accounts.
        assigned_count = await db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.contributor_directory_order.is_not(None))
        )
        user.contributor_directory_order = (assigned_count or 0) + 1
    if created and invitation.profile_details:
        for field in ("display_name", "bio", "alias", "positions", "contributions", "social_links"):
            if field in invitation.profile_details:
                setattr(user, field, invitation.profile_details[field])
        await db.flush()
    if created:
        await activity_log_service.log_activity(
            db,
            user_id=user.id,
            owner_id=user.id,
            audience=ActivityAudience.USER_MANAGEMENT,
            action=ActivityAction.CREATED,
            resource=ActivityResource.USER,
            resource_id=user.id,
            details={
                "invitation_id": str(invitation.id),
                "assigned_role": invitation.assigned_role,
                "lifecycle": InvitationStatus.ACCEPTED.value,
            },
        )
    return user, created
