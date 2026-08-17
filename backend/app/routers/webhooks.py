import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/webhooks",
    tags=["Webhooks"],
)


def build_display_name(data: dict) -> str:
    """Pick something human-readable, since Clerk never sends a display_name."""
    username = data.get("username")

    if username:
        return username

    full_name = " ".join(
        part for part in (data.get("first_name"), data.get("last_name")) if part
    )

    if full_name:
        return full_name

    emails = data.get("email_addresses") or []

    if emails:
        address = emails[0].get("email_address")

        if address:
            return address.split("@")[0]

    return "Member"


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
    if event_type != "user.created":
        logger.info("Ignoring Clerk webhook: %s", event_type)

        return {"ignored": event_type}

    data = event["data"]
    clerk_user_id = data["id"]

    # Svix retries on any non-2xx, so the same event can arrive more than once.
    # Without this check the second delivery would violate the unique constraint.
    existing = await db.execute(
        select(User).where(
            User.clerk_user_id == clerk_user_id
        )
    )

    if existing.scalar_one_or_none() is not None:
        logger.info("User already exists, skipping: %s", clerk_user_id)

        return {"status": "already_exists", "clerk_user_id": clerk_user_id}

    user = User(
        clerk_user_id=clerk_user_id,
        # Clerk sends "" as often as null for a missing name; store neither.
        first_name=data.get("first_name") or None,
        last_name=data.get("last_name") or None,
        display_name=build_display_name(data),
    )

    db.add(user)

    try:
        await db.commit()
    except IntegrityError:
        # Two deliveries can both pass the check above before either commits.
        # The row exists either way, so this is still a success.
        await db.rollback()

        logger.info("Concurrent insert for %s, treating as success", clerk_user_id)

        return {"status": "already_exists", "clerk_user_id": clerk_user_id}

    logger.info("Created user %s for %s", user.id, clerk_user_id)

    return {"status": "created", "clerk_user_id": clerk_user_id}
