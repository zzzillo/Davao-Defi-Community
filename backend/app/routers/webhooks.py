import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from app.database import get_db
from app.services.user_service import upsert_user_from_clerk

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/webhooks",
    tags=["Webhooks"],
)

# Both carry a full Clerk user object, so both go through the same upsert.
USER_EVENTS = frozenset({"user.created", "user.updated"})


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    secret = os.environ["CLERK_WEBHOOK_SIGNING_SECRET"]

    # Svix signs the exact bytes it sent. Letting FastAPI parse the body into a
    # model and re-serializing it would produce different bytes and fail an
    # otherwise valid signature, so the raw body goes to verify() untouched.
    payload = await request.body()

    try:
        # verify() checks the HMAC and the svix-timestamp freshness window,
        # then returns the already-parsed JSON body.
        event = Webhook(secret).verify(payload, dict(request.headers))
    except WebhookVerificationError as exc:
        logger.warning("Rejected Clerk webhook: %s", exc)

        raise HTTPException(
            status_code=400,
            detail="Invalid webhook signature",
        )

    event_type = event["type"]

    # Anything we don't handle still gets a 2xx, or Svix retries it forever.
    if event_type not in USER_EVENTS:
        logger.info("Ignoring Clerk webhook: %s", event_type)

        return {"ignored": event_type}

    user, created = await upsert_user_from_clerk(db, event["data"])

    logger.info(
        "%s user %s from %s",
        "Created" if created else "Updated",
        user.id,
        event_type,
    )

    return {
        "status": "created" if created else "updated",
        "clerk_user_id": user.clerk_user_id,
    }
