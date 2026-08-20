"""Writes to the local users table.

Sits between the routers and the model so the same logic can serve a webhook and,
later, the admin endpoints. Routers stay concerned with HTTP; this file stays
concerned with what a User row should contain.
"""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import parse_permissions, parse_role
from app.models.user import User

logger = logging.getLogger(__name__)


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


def read_authorization(data: dict) -> tuple[str, list[str]]:
    """Read role and permissions out of a Clerk payload's public_metadata.

    Uses the same parsers the JWT path uses. One definition of what this metadata
    means, so the mirror can never disagree with the gates for any reason other
    than lag.
    """
    metadata = data.get("public_metadata")

    if not isinstance(metadata, dict):
        metadata = {}

    role = parse_role(metadata.get("role"))
    permissions = parse_permissions(metadata.get("permissions"))

    # Sorted so an unchanged permission set never looks like a change.
    return role.value, sorted(permission.value for permission in permissions)


def _apply_clerk_fields(user: User, data: dict) -> None:
    """Copy the Clerk-owned fields onto a row.

    Only the fields Clerk owns. bio and team_id are ours, and their absence here
    is the point: an edit made in our app has to survive the next user.updated.
    """
    # Clerk sends "" as often as null for a missing name; store neither.
    user.first_name = data.get("first_name") or None
    user.last_name = data.get("last_name") or None
    user.display_name = build_display_name(data)
    user.role, user.permissions = read_authorization(data)


async def _get_by_clerk_id(db: AsyncSession, clerk_user_id: str) -> User | None:
    result = await db.execute(
        select(User).where(User.clerk_user_id == clerk_user_id)
    )

    return result.scalar_one_or_none()


async def upsert_user_from_clerk(
    db: AsyncSession,
    data: dict,
) -> tuple[User, bool]:
    """Create or refresh the local row for a Clerk user.

    Serves user.created and user.updated alike, since both carry the same payload.
    That makes it safe under Svix retries by construction - a repeated create
    lands as an update - and it repairs a row whose user.created was missed while
    the webhook tunnel was down.

    Returns (user, created).
    """
    clerk_user_id = data["id"]

    user = await _get_by_clerk_id(db, clerk_user_id)
    created = user is None

    if user is None:
        user = User(clerk_user_id=clerk_user_id)
        db.add(user)

    _apply_clerk_fields(user, data)

    try:
        await db.commit()
    except IntegrityError:
        # Two deliveries both read "no row" before either committed. The other
        # one won; re-read and apply on top of it rather than losing this update.
        await db.rollback()

        logger.info("Concurrent insert for %s, re-applying", clerk_user_id)

        user = await _get_by_clerk_id(db, clerk_user_id)

        if user is None:
            raise

        _apply_clerk_fields(user, data)
        await db.commit()
        created = False

    return user, created
