"""Application-owned invitations coordinated with Clerk's provider lifecycle."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.locks import USER_MUTATION_LOCK_KEY
from app.auth.permissions import Role, parse_role, role_at_least
from app.models.activity_log import ActivityAction, ActivityAudience, ActivityResource
from app.models.user import AccountStatus, User
from app.models.user_invitation import InvitationStatus, UserInvitation
from app.services import activity_log_service, clerk_service

logger = logging.getLogger(__name__)
INVITATION_TTL = timedelta(days=30)


class InvitationDeliveryUncertain(Exception):
    """The provider did not give a conclusive delivery result."""


class InvitationNotAccepted(Exception):
    """The provider invitation is not in an accepted, eligible state."""


class InvitationProviderUnavailable(Exception):
    """The Backend API could not confirm the invitation's current state."""


class InvitationRevocationUncertain(Exception):
    """Clerk revocation could not be confirmed; local access stays revoked."""


class InvitationAlreadyAccepted(Exception):
    """An accepted account must be suspended through user management."""


class InvitationActorUnauthorized(Exception):
    """The actor lost admin authority before the provider write began."""


def _value(obj, name: str, default=None):
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _provider_date(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        if value is not None:
            return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None
    return None


def _provider_status(provider_invitation) -> str | None:
    status = _value(provider_invitation, "status")
    return getattr(status, "value", status)


async def provider_invitation_for_local(invitation: UserInvitation):
    if invitation.clerk_invitation_id:
        provider_invitation = await clerk_service.find_clerk_invitation(invitation.clerk_invitation_id)
    elif invitation.delivery_attempts > 0:
        # The POST may have committed at Clerk while its response was lost.
        # The app-owned metadata marker recovers the provider id safely.
        provider_invitation = await _find_uncertain_provider_invitation(invitation)
        if provider_invitation is not None:
            invitation.clerk_invitation_id = _value(provider_invitation, "id")
    else:
        return None
    if (
        provider_invitation is None
        or (_value(provider_invitation, "email_address") or "").strip().lower() != invitation.email
        or (_value(provider_invitation, "public_metadata") or {}).get("ddc_invitation_id")
        != str(invitation.id)
    ):
        return None
    return provider_invitation


async def accepted_provider_invitation(invitation: UserInvitation):
    """Require the exact stored provider invite to be accepted for its email."""
    try:
        provider_invitation = await provider_invitation_for_local(invitation)
    except Exception as exc:
        logger.warning("Could not confirm Clerk invitation acceptance")
        raise InvitationProviderUnavailable from exc
    if (
        provider_invitation is None
        or (_value(provider_invitation, "email_address") or "").strip().lower() != invitation.email
        or (_value(provider_invitation, "public_metadata") or {}).get("ddc_invitation_id")
        != str(invitation.id)
    ):
        raise InvitationNotAccepted
    provider_status = _provider_status(provider_invitation)
    if provider_status == InvitationStatus.ACCEPTED.value:
        # Provider acceptance is proof the invite was used before the
        # provider-side expiration; a delayed webhook may arrive later.
        return provider_invitation
    if provider_status == InvitationStatus.REVOKED.value:
        invitation.status = InvitationStatus.REVOKED.value
    elif provider_status == InvitationStatus.EXPIRED.value or (
        invitation.expires_at is not None
        and invitation.expires_at <= datetime.now(timezone.utc)
    ):
        invitation.status = InvitationStatus.EXPIRED.value
    raise InvitationNotAccepted


def apply_provider_state(
    invitation: UserInvitation,
    provider_invitation,
) -> str:
    """Refresh the local lifecycle from one exact provider invitation."""
    now = datetime.now(timezone.utc)
    if invitation.status in {InvitationStatus.REVOKED.value, InvitationStatus.EXPIRED.value}:
        return invitation.status

    status = _provider_status(provider_invitation)
    if status == InvitationStatus.ACCEPTED.value:
        invitation.status = InvitationStatus.ACCEPTED.value
        invitation.accepted_at = invitation.accepted_at or now
    elif status == InvitationStatus.REVOKED.value:
        invitation.status = InvitationStatus.REVOKED.value
    elif status == InvitationStatus.EXPIRED.value:
        invitation.status = InvitationStatus.EXPIRED.value
    elif status == InvitationStatus.PENDING.value:
        invitation.status = InvitationStatus.PENDING.value
        invitation.failed_at = None
        invitation.failure_reason = None
    return invitation.status


async def _find_uncertain_provider_invitation(invitation: UserInvitation):
    """Reconcile by an exact app-generated marker; email alone is ambiguous."""
    try:
        invitations_api = clerk_service.get_clerk().invitations
        candidates = []
        for status in (None, "revoked"):
            candidates.extend(
                await invitations_api.list_async(
                    query=invitation.email,
                    status=status,
                    limit=100,
                    offset=0,
                )
            )
    except Exception:
        logger.warning("Could not reconcile uncertain Clerk invitation")
        raise InvitationProviderUnavailable

    matches = [
        item
        for item in candidates
        if (_value(item, "email_address") or "").strip().lower() == invitation.email
        and (_value(item, "public_metadata") or {}).get("ddc_invitation_id") == str(invitation.id)
    ]
    if len(matches) == 1:
        return matches[0]
    return None


async def _lock_actor_and_invitation(
    db: AsyncSession,
    actor_id,
    invitation_id,
) -> tuple[User, UserInvitation]:
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
    invitation = await db.scalar(
        select(UserInvitation)
        .where(UserInvitation.id == invitation_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if (
        actor is None
        or actor.status != AccountStatus.ACTIVE.value
        or actor.clerk_deleted_at is not None
        or not role_at_least(parse_role(actor.role), Role.ADMIN)
        or invitation is None
    ):
        raise InvitationActorUnauthorized
    if parse_role(actor.role) is Role.ADMIN and invitation.assigned_role not in {
        Role.MEMBER.value,
        Role.OFFICIAL.value,
    }:
        raise InvitationActorUnauthorized
    return actor, invitation


async def deliver_invitation(
    db: AsyncSession,
    invitation: UserInvitation,
    *,
    actor_id,
) -> UserInvitation:
    """Persist, reconcile, and deliver under the shared role mutation lock."""
    invitation_id = invitation.id
    _, invitation = await _lock_actor_and_invitation(db, actor_id, invitation_id)
    now = datetime.now(timezone.utc)
    if invitation.status in {
        InvitationStatus.ACCEPTED.value,
        InvitationStatus.REVOKED.value,
        InvitationStatus.EXPIRED.value,
    }:
        return invitation
    if invitation.expires_at and invitation.expires_at <= now:
        if invitation.clerk_invitation_id or invitation.delivery_attempts > 0:
            try:
                provider_invitation = await provider_invitation_for_local(invitation)
            except Exception as exc:
                raise InvitationDeliveryUncertain from exc
            if provider_invitation and _provider_status(provider_invitation) == InvitationStatus.ACCEPTED.value:
                apply_provider_state(invitation, provider_invitation)
                await db.commit()
                return invitation
        invitation.status = InvitationStatus.EXPIRED.value
        await db.commit()
        return invitation

    # A worker may have died after committing its attempt but before finishing
    # the provider call. Keep concurrent retries from sending another email.
    if (
        invitation.status == InvitationStatus.PENDING.value
        and invitation.delivery_attempts > 0
        and invitation.delivery_started_at is not None
        and now - invitation.delivery_started_at < timedelta(minutes=5)
        and not invitation.clerk_invitation_id
    ):
        # A prior process may have died after recording intent but before a
        # definitive provider response. Do not tell the caller delivery worked.
        raise InvitationDeliveryUncertain

    provider_invitation = None
    if invitation.clerk_invitation_id:
        try:
            provider_invitation = await provider_invitation_for_local(invitation)
        except Exception as exc:
            logger.warning("Could not reconcile stored Clerk invitation")
            invitation.status = InvitationStatus.FAILED.value
            invitation.failed_at = now
            invitation.failure_reason = "provider_reconciliation_uncertain"
            await db.commit()
            raise InvitationDeliveryUncertain from exc
        if provider_invitation is not None:
            apply_provider_state(invitation, provider_invitation)
            invitation.expires_at = _provider_date(_value(provider_invitation, "expires_at")) or invitation.expires_at
            await db.commit()
            return invitation
        # An exact stored ID was not returned. Do not create a duplicate based
        # on an absence that could be a transient provider inconsistency.
        invitation.status = InvitationStatus.FAILED.value
        invitation.failed_at = now
        invitation.failure_reason = "provider_invitation_unavailable"
        await db.commit()
        raise InvitationDeliveryUncertain
    elif invitation.delivery_attempts > 0:
        try:
            provider_invitation = await _find_uncertain_provider_invitation(invitation)
        except InvitationProviderUnavailable as exc:
            invitation.status = InvitationStatus.FAILED.value
            invitation.failed_at = now
            invitation.failure_reason = "provider_reconciliation_uncertain"
            await db.commit()
            raise InvitationDeliveryUncertain from exc
        if provider_invitation is not None:
            invitation.clerk_invitation_id = _value(provider_invitation, "id")
            apply_provider_state(invitation, provider_invitation)
            invitation.expires_at = _provider_date(_value(provider_invitation, "expires_at")) or invitation.expires_at
            await db.commit()
            return invitation

    # Persist the attempt before sending. This commit releases the advisory
    # lock, so re-acquire it immediately and verify that no revoke, retry, or
    # demotion won the gap before making the provider call.
    started = now
    invitation.delivery_started_at = started
    invitation.delivery_attempts += 1
    invitation.status = InvitationStatus.PENDING.value
    invitation.failed_at = None
    invitation.failure_reason = None
    await db.commit()

    _, invitation = await _lock_actor_and_invitation(db, actor_id, invitation_id)
    now = datetime.now(timezone.utc)
    if (
        invitation.status != InvitationStatus.PENDING.value
        or invitation.delivery_started_at != started
        or (invitation.expires_at and invitation.expires_at <= now)
    ):
        if invitation.expires_at and invitation.expires_at <= now and invitation.status == InvitationStatus.PENDING.value:
            invitation.status = InvitationStatus.EXPIRED.value
            await db.commit()
        return invitation

    try:
        provider_invitation = await clerk_service.get_clerk().invitations.create_async(
            request={
                "email_address": invitation.email,
                "expires_in_days": 30,
                "ignore_existing": False,
                "notify": True,
                # This opaque app id is only for reconciliation. Authorization
                # always comes from the local invitation row and role.
                "public_metadata": {"ddc_invitation_id": str(invitation.id)},
            },
            retries=clerk_service.no_automatic_retries(),
        )
    except Exception as exc:
        logger.warning("Clerk invitation delivery did not return a conclusive result")
        try:
            provider_invitation = await _find_uncertain_provider_invitation(invitation)
        except InvitationProviderUnavailable:
            provider_invitation = None
        if provider_invitation is not None:
            invitation.clerk_invitation_id = _value(provider_invitation, "id")
            apply_provider_state(invitation, provider_invitation)
            invitation.expires_at = _provider_date(_value(provider_invitation, "expires_at")) or invitation.expires_at
            await db.commit()
            if invitation.status in {InvitationStatus.PENDING.value, InvitationStatus.ACCEPTED.value}:
                return invitation

        invitation.status = InvitationStatus.FAILED.value
        invitation.failed_at = datetime.now(timezone.utc)
        invitation.failure_reason = "provider_delivery_uncertain"
        await db.commit()
        raise InvitationDeliveryUncertain from exc

    invitation.clerk_invitation_id = _value(provider_invitation, "id")
    provider_state = _provider_status(provider_invitation)
    if provider_state in {
        InvitationStatus.ACCEPTED.value,
        InvitationStatus.REVOKED.value,
        InvitationStatus.EXPIRED.value,
    }:
        apply_provider_state(invitation, provider_invitation)
    else:
        invitation.status = InvitationStatus.PENDING.value
    invitation.expires_at = _provider_date(_value(provider_invitation, "expires_at")) or (
        now + INVITATION_TTL
    )
    await db.commit()
    return invitation


async def refresh_invitation_from_provider(
    db: AsyncSession,
    invitation: UserInvitation,
) -> str:
    """Sync a local invite with Clerk, respecting local terminal states."""
    now = datetime.now(timezone.utc)
    if invitation.status in {InvitationStatus.REVOKED.value, InvitationStatus.EXPIRED.value}:
        return invitation.status
    provider_invitation = await provider_invitation_for_local(invitation)
    if provider_invitation is None:
        if invitation.expires_at and invitation.expires_at <= now:
            invitation.status = InvitationStatus.EXPIRED.value
            await db.flush()
        return invitation.status
    invitation.expires_at = _provider_date(_value(provider_invitation, "expires_at")) or invitation.expires_at
    return apply_provider_state(invitation, provider_invitation)


async def revoke_invitation(
    db: AsyncSession,
    invitation: UserInvitation,
    *,
    actor_id,
) -> UserInvitation:
    """Revoke locally first, then retry provider reconciliation as needed."""
    invitation_id = invitation.id
    _, invitation = await _lock_actor_and_invitation(db, actor_id, invitation_id)
    if invitation.status == InvitationStatus.ACCEPTED.value or invitation.accepted_clerk_user_id:
        raise InvitationAlreadyAccepted
    if invitation.status == InvitationStatus.EXPIRED.value:
        return invitation
    if (
        invitation.status == InvitationStatus.REVOKED.value
        and invitation.failure_reason != "provider_revocation_uncertain"
    ):
        return invitation
    was_revoked = invitation.status == InvitationStatus.REVOKED.value

    async def log_revocation() -> None:
        if was_revoked:
            return
        await activity_log_service.log_activity(
            db,
            user_id=actor_id,
            owner_id=actor_id,
            audience=ActivityAudience.USER_MANAGEMENT,
            action=ActivityAction.UPDATED,
            resource=ActivityResource.USER,
            resource_id=invitation.id,
            details={
                "invitation_id": str(invitation.id),
                "lifecycle": InvitationStatus.REVOKED.value,
            },
        )

    # A read error still closes local onboarding. Retrying this endpoint will
    # reconcile the remote state because the uncertain marker remains stored.
    try:
        provider_invitation = await provider_invitation_for_local(invitation)
    except Exception as exc:
        invitation.status = InvitationStatus.REVOKED.value
        invitation.failure_reason = "provider_revocation_uncertain"
        await log_revocation()
        await db.commit()
        raise InvitationRevocationUncertain from exc

    provider_status = _provider_status(provider_invitation) if provider_invitation else None
    if provider_status == InvitationStatus.ACCEPTED.value:
        if invitation.status == InvitationStatus.REVOKED.value:
            invitation.failure_reason = "provider_revocation_uncertain"
            await db.commit()
            raise InvitationRevocationUncertain
        invitation.status = InvitationStatus.ACCEPTED.value
        invitation.accepted_at = invitation.accepted_at or datetime.now(timezone.utc)
        await db.commit()
        raise InvitationAlreadyAccepted
    if provider_status == InvitationStatus.EXPIRED.value:
        if invitation.status != InvitationStatus.REVOKED.value:
            invitation.status = InvitationStatus.EXPIRED.value
        invitation.failure_reason = None
        await db.commit()
        return invitation
    if provider_status == InvitationStatus.REVOKED.value or not invitation.clerk_invitation_id:
        invitation.status = InvitationStatus.REVOKED.value
        invitation.failure_reason = None
        await log_revocation()
        await db.commit()
        return invitation

    invitation.status = InvitationStatus.REVOKED.value
    invitation.failure_reason = "provider_revocation_uncertain"
    await log_revocation()
    await db.commit()

    # The commit above makes revocation fail closed. Re-enter the shared lock
    # before contacting Clerk so a role change or simultaneous retry cannot
    # race the provider operation.
    _, invitation = await _lock_actor_and_invitation(db, actor_id, invitation_id)
    if invitation.status != InvitationStatus.REVOKED.value:
        return invitation
    try:
        await clerk_service.get_clerk().invitations.revoke_async(
            invitation_id=invitation.clerk_invitation_id,
            retries=clerk_service.no_automatic_retries(),
        )
        invitation.failure_reason = None
        await db.commit()
        return invitation
    except Exception as exc:
        logger.warning("Clerk invitation revocation needs reconciliation")
        try:
            provider_invitation = await provider_invitation_for_local(invitation)
        except Exception:
            provider_invitation = None
        if provider_invitation and _provider_status(provider_invitation) == InvitationStatus.REVOKED.value:
            invitation.failure_reason = None
            await db.commit()
            return invitation
        invitation.failure_reason = "provider_revocation_uncertain"
        await db.commit()
        raise InvitationRevocationUncertain from exc


async def latest_eligible_invitation_for_email(
    db: AsyncSession,
    email: str,
) -> UserInvitation | None:
    """Find the newest non-terminal local invitation for an exact email.

    Provider acceptance must be checked before local expiry is applied so a
    delayed webhook cannot strand an account that accepted on time.
    """
    invitation = await db.scalar(
        select(UserInvitation)
        .where(
            UserInvitation.email == email,
            UserInvitation.status.in_(
                (
                    InvitationStatus.PENDING.value,
                    InvitationStatus.ACCEPTED.value,
                    InvitationStatus.FAILED.value,
                )
            ),
        )
        .order_by(
            (UserInvitation.status == InvitationStatus.ACCEPTED.value).desc(),
            UserInvitation.created_at.desc(),
            UserInvitation.id.desc(),
        )
        .limit(1)
        .with_for_update()
    )
    return invitation


async def accepted_expired_invitation_for_email(
    db: AsyncSession,
    email: str,
) -> UserInvitation | None:
    """Find late-processed accepts before a new invite can shadow them."""
    now = datetime.now(timezone.utc)
    expired_candidates = await db.scalars(
        select(UserInvitation)
        .where(
            UserInvitation.email == email,
            UserInvitation.status.in_((InvitationStatus.PENDING.value, InvitationStatus.FAILED.value)),
            UserInvitation.expires_at <= now,
            UserInvitation.delivery_attempts > 0,
        )
        .order_by(UserInvitation.created_at.desc(), UserInvitation.id.desc())
        .with_for_update()
    )
    for invitation in expired_candidates:
        try:
            provider_invitation = await provider_invitation_for_local(invitation)
        except Exception as exc:
            logger.warning("Could not reconcile an expired Clerk invitation")
            raise InvitationProviderUnavailable from exc
        if provider_invitation and _provider_status(provider_invitation) == InvitationStatus.ACCEPTED.value:
            invitation.status = InvitationStatus.ACCEPTED.value
            invitation.accepted_at = invitation.accepted_at or datetime.now(timezone.utc)
            await db.flush()
            return invitation
    return None
