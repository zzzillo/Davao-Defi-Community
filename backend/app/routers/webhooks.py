"""Signed Clerk lifecycle webhooks with transactional receipt deduplication."""

from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from app.auth.locks import USER_MUTATION_LOCK_KEY
from app.config import get_settings
from app.database import get_db
from app.models.clerk_webhook_event import ClerkWebhookEvent
from app.models.user import User
from app.services import clerk_onboarding_service, clerk_service, invitation_service, user_service
from app.services.user_service import suspend_deleted_clerk_user
from app.security.rate_limits import limit_webhook

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
USER_EVENTS = frozenset({"user.created", "user.updated", "user.deleted"})


def _event_time(value) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None


@router.post("/clerk", dependencies=[Depends(limit_webhook)])
async def clerk_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    secret = get_settings().clerk_webhook_signing_secret
    if not secret:
        raise HTTPException(status_code=503, detail={"reason": "clerk_webhook_not_configured"})

    payload = await request.body()
    try:
        event = Webhook(secret).verify(payload, dict(request.headers))
    except (WebhookVerificationError, ValueError, TypeError) as exc:
        logger.warning("Rejected Clerk webhook signature")
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from exc

    event_id = request.headers.get("svix-id")
    event_type = event.get("type")
    event_at = _event_time(event.get("timestamp"))
    if not event_id or not isinstance(event_type, str) or event_at is None:
        raise HTTPException(status_code=400, detail="Invalid webhook event envelope")

    receipt = pg_insert(ClerkWebhookEvent).values(
        event_id=event_id,
        event_type=event_type,
        event_at=event_at,
    ).on_conflict_do_nothing(index_elements=[ClerkWebhookEvent.event_id]).returning(
        ClerkWebhookEvent.event_id
    )
    inserted_id = (await db.execute(receipt)).scalar_one_or_none()
    if inserted_id is None:
        await db.commit()
        return {"duplicate": True}

    if event_type not in USER_EVENTS:
        await db.commit()
        logger.info("Ignored signed Clerk event type %s", event_type)
        return {"ignored": event_type}

    data = event.get("data") or {}
    clerk_user_id = data.get("id")
    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Invalid Clerk user event")

    if event_type == "user.deleted":
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:lock_key)"),
            {"lock_key": USER_MUTATION_LOCK_KEY},
        )
        await suspend_deleted_clerk_user(db, clerk_user_id, event_at)
        await db.commit()
        return {"status": "deleted"}

    # Deleted subjects are permanent tombstones. Check while holding the same
    # lock used by onboarding so a delayed create/update cannot trigger a
    # provider 404 retry loop or race a newer deletion.
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:lock_key)"),
        {"lock_key": USER_MUTATION_LOCK_KEY},
    )
    tombstone = await db.scalar(
        select(User)
        .where(User.clerk_user_id == clerk_user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if tombstone is not None and tombstone.clerk_deleted_at is not None:
        await db.commit()
        return {"ignored": "clerk_identity_deleted"}

    # Webhook data is only a signal to fetch. Clerk's Backend API supplies the
    # canonical primary_email_address_id and verified email used by onboarding.
    try:
        provider_user = await clerk_service.get_clerk_user(clerk_user_id)
    except Exception as exc:
        await db.rollback()
        logger.warning("Clerk webhook could not fetch canonical user")
        raise HTTPException(status_code=503, detail={"reason": "clerk_user_sync_unavailable"}) from exc
    provider_data = user_service._dict(provider_user)
    if provider_data.get("id") != clerk_user_id:
        await db.rollback()
        raise HTTPException(status_code=503, detail={"reason": "clerk_user_sync_unavailable"})

    try:
        user, created = await clerk_onboarding_service.synchronize_clerk_identity(
            db,
            provider_data,
            event_at=event_at,
        )
    except user_service.UninvitedClerkUser:
        # There is no local authorization to provision. A retry will not change
        # that fact, and acknowledging the receipt prevents endless retries.
        await db.commit()
        logger.warning("Ignored uninvited Clerk user lifecycle event")
        return {"ignored": "invitation_required"}
    except invitation_service.InvitationNotAccepted:
        await db.commit()
        logger.info("Deferred Clerk identity until its local invitation is accepted")
        return {"ignored": "invitation_not_accepted"}
    except invitation_service.InvitationProviderUnavailable as exc:
        await db.rollback()
        raise HTTPException(status_code=503, detail={"reason": "clerk_invitation_sync_unavailable"}) from exc

    await db.commit()
    return {"status": "created" if created else "updated"}
