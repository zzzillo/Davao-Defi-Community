"""Synchronize Clerk identity without importing app-owned profile or access."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import Role
from app.models.activity_log import ActivityAction, ActivityAudience, ActivityResource
from app.models.user import AccountStatus, User
from app.models.user_invitation import InvitationStatus, UserInvitation
from app.services import slug_service
from app.services.exceptions import PublicSlugAlreadyExists
from app.services import activity_log_service

logger = logging.getLogger(__name__)


def public_contributor_conditions():
    return (
        User.show_in_contributor_directory.is_(True),
        User.status == AccountStatus.ACTIVE.value,
        User.public_slug.is_not(None),
    )


class UninvitedClerkUser(Exception):
    """A Clerk identity has no accepted local invitation for its primary email."""


def _dict(value):
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="python", by_alias=False)
    return {}


def verified_primary_email(data: dict) -> str | None:
    """Return only the exact, verified Clerk primary email address."""
    primary_id = data.get("primary_email_address_id") or data.get("primaryEmailAddressId")
    if not primary_id:
        return None
    for raw_item in data.get("email_addresses") or data.get("emailAddresses") or []:
        item = _dict(raw_item)
        if item.get("id") != primary_id:
            continue
        verification = _dict(item.get("verification"))
        if verification.get("status") != "verified":
            return None
        email = item.get("email_address") or item.get("emailAddress")
        return email.strip().lower() if isinstance(email, str) and email.strip() else None
    return None


def _date_from_ms(value) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc) if value is not None else None
    except (TypeError, ValueError, OverflowError):
        return None


def build_display_name(data: dict) -> str:
    """Pick a human-readable initial display name from Clerk-owned identity."""
    username = data.get("username")
    if username:
        return username
    full_name = " ".join(
        part for part in (data.get("first_name"), data.get("last_name")) if part
    )
    if full_name:
        return full_name
    email = verified_primary_email(data)
    if email:
        return email.split("@", 1)[0]
    return "Member"


def _apply_clerk_identity(user: User, data: dict, *, is_new: bool) -> None:
    """Refresh only identity fields; retain role, status and app profile edits."""
    user.first_name = data.get("first_name") or None
    user.last_name = data.get("last_name") or None
    email = verified_primary_email(data)
    # Unverified or absent primary email data must never displace the last
    # verified email bound to this local account.
    if email:
        user.email = email
    if is_new:
        user.display_name = build_display_name(data)


async def get_by_clerk_id(db: AsyncSession, clerk_user_id: str) -> User | None:
    return await db.scalar(select(User).where(User.clerk_user_id == clerk_user_id))


async def set_public_slug(
    db: AsyncSession,
    user: User,
    requested_slug: str | None,
) -> None:
    """Assign a unique contributor URL, generating a stable one when needed."""
    if requested_slug is None:
        base = slug_service.slugify(user.display_name, max_length=110) or f"contributor-{str(user.id)[:8]}"
        candidate = base
        suffix = 2
        while await db.scalar(
            select(User.id).where(User.public_slug == candidate, User.id != user.id)
        ) is not None:
            candidate = f"{base[:110]}-{suffix}"
            suffix += 1
    else:
        candidate = requested_slug
        existing_id = await db.scalar(
            select(User.id).where(User.public_slug == candidate, User.id != user.id)
        )
        if existing_id is not None:
            raise PublicSlugAlreadyExists(candidate)
    user.public_slug = candidate


async def accepted_invitation_for_email(
    db: AsyncSession,
    email: str,
) -> UserInvitation | None:
    """Return the latest accepted invitation whose email matches exactly."""
    return await db.scalar(
        select(UserInvitation)
        .where(
            UserInvitation.email == email.strip().lower(),
            UserInvitation.status == InvitationStatus.ACCEPTED.value,
        )
        .order_by(UserInvitation.created_at.desc(), UserInvitation.id.desc())
        .limit(1)
        .with_for_update()
    )


async def upsert_user_from_clerk(
    db: AsyncSession,
    data: dict,
    *,
    invitation: UserInvitation | None = None,
    event_at: datetime | None = None,
) -> tuple[User, bool]:
    """Create only from an accepted invite; otherwise refresh an existing row.

    The caller owns the transaction and should take the shared user mutation
    advisory lock before invoking this function. New rows inherit the role from
    the accepted local invitation. Existing rows retain every app-owned field.
    """
    data = _dict(data)
    clerk_user_id = data.get("id")
    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        raise UninvitedClerkUser

    user = await db.scalar(
        select(User)
        .where(User.clerk_user_id == clerk_user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    created = user is None
    if user is None:
        email = verified_primary_email(data)
        if invitation is None or email is None or invitation.email != email:
            raise UninvitedClerkUser
        if invitation.status != InvitationStatus.ACCEPTED.value:
            raise UninvitedClerkUser
        if invitation.accepted_clerk_user_id not in (None, clerk_user_id):
            raise UninvitedClerkUser
        invitation.accepted_clerk_user_id = clerk_user_id

        # Do not attach a second Clerk identity to an existing local profile.
        conflicting = await db.scalar(
            select(User.id).where(User.email == email, User.clerk_user_id != clerk_user_id).limit(1)
        )
        if conflicting is not None:
            raise UninvitedClerkUser

        user = User(
            clerk_user_id=clerk_user_id,
            display_name=build_display_name(data),
            role=invitation.assigned_role,
            status=AccountStatus.ACTIVE.value,
            permissions=[],
        )
        db.add(user)

    # Once Clerk deleted this subject, delayed create/update deliveries must not
    # bring the account back. Clerk user IDs are not reused.
    if user.clerk_deleted_at is not None:
        return user, False

    incoming_updated = _date_from_ms(data.get("updated_at"))
    if incoming_updated and user.clerk_updated_at:
        if incoming_updated < user.clerk_updated_at:
            return user, created
        if incoming_updated == user.clerk_updated_at and event_at and user.clerk_event_at:
            if event_at <= user.clerk_event_at:
                return user, created

    _apply_clerk_identity(user, data, is_new=created)
    if incoming_updated:
        user.clerk_updated_at = incoming_updated
    if event_at and (user.clerk_event_at is None or event_at >= user.clerk_event_at):
        user.clerk_event_at = event_at
    await db.flush()
    return user, created


async def suspend_deleted_clerk_user(
    db: AsyncSession,
    clerk_user_id: str,
    deleted_at: datetime,
) -> User:
    """Soft-delete a Clerk identity while retaining authorship and audit links."""
    user = await db.scalar(
        select(User)
        .where(User.clerk_user_id == clerk_user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    was_deleted = user.clerk_deleted_at is not None if user is not None else False
    previous_status = user.status if user is not None else None
    if user is None:
        user = User(
            clerk_user_id=clerk_user_id,
            display_name="Member",
            role=Role.MEMBER.value,
            status=AccountStatus.SUSPENDED.value,
            permissions=[],
        )
        db.add(user)
    elif user.clerk_event_at is not None and deleted_at <= user.clerk_event_at:
        # Older deletion deliveries must not overwrite a newer identity event.
        return user
    user.status = AccountStatus.SUSPENDED.value
    if user.clerk_deleted_at is None or deleted_at > user.clerk_deleted_at:
        user.clerk_deleted_at = deleted_at
    if user.clerk_event_at is None or deleted_at > user.clerk_event_at:
        user.clerk_event_at = deleted_at
    await db.flush()
    if not was_deleted or previous_status != AccountStatus.SUSPENDED.value:
        await activity_log_service.log_activity(
            db,
            user_id=None,
            owner_id=user.id,
            audience=ActivityAudience.USER_MANAGEMENT,
            action=ActivityAction.SUSPENDED,
            resource=ActivityResource.USER,
            resource_id=user.id,
            details={"source": "clerk", "lifecycle": "deleted"},
        )
    return user
