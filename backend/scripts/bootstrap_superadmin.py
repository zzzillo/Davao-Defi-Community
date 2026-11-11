"""One-time, operator-run bootstrap of the first active superadmin.

Run from ``backend`` after the Clerk production/development app and database
are configured:

    .venv/bin/python scripts/bootstrap_superadmin.py admin@example.com

The script requires the exact verified primary email on a Clerk user and
refuses to run if any superadmin row already exists. It is not exposed by the
application API and does not read role metadata from Clerk.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.getcwd())

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), ".env"))

from sqlalchemy import func, select, text

from app.auth.locks import USER_MUTATION_LOCK_KEY
from app.auth.permissions import Role
from app.database import AsyncSessionLocal
from app.models.activity_log import ActivityAction, ActivityAudience, ActivityLog, ActivityResource
from app.models.user import AccountStatus, User
from app.services import clerk_service, user_service


class BootstrapRefused(Exception):
    """A safe, user-facing reason the one-time bootstrap did not run."""


def parse_email() -> str:
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/bootstrap_superadmin.py <verified-primary-email>")
    email = sys.argv[1].strip().lower()
    if "@" not in email or any(character.isspace() for character in email):
        sys.exit("Provide a valid email address.")
    return email


async def bootstrap_first_superadmin(email: str):
    email = email.strip().lower()
    if "@" not in email or any(character.isspace() for character in email):
        raise BootstrapRefused("Provide a valid email address.")
    try:
        provider_user = await clerk_service.find_verified_clerk_user_by_primary_email(email)
    except Exception as exc:
        raise BootstrapRefused(
            "Could not verify that identity with Clerk. Check the configured Clerk API key and try again."
        ) from exc
    if provider_user is None:
        raise BootstrapRefused("No Clerk user has that exact verified primary email.")

    provider_data = user_service._dict(provider_user)
    clerk_user_id = provider_data.get("id")
    if not clerk_user_id or user_service.verified_primary_email(provider_data) != email:
        raise BootstrapRefused("Clerk did not confirm the requested verified primary email.")

    async with AsyncSessionLocal() as db:
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:lock_key)"),
            {"lock_key": USER_MUTATION_LOCK_KEY},
        )
        existing_superadmins = await db.scalar(
            select(func.count()).select_from(User).where(User.role == Role.SUPERADMIN.value)
        ) or 0
        if existing_superadmins:
            await db.rollback()
            raise BootstrapRefused("Bootstrap refused: a superadmin already exists.")

        user = await db.scalar(
            select(User)
            .where(User.clerk_user_id == clerk_user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        email_owner = await db.scalar(
            select(User.id)
            .where(User.email == email, User.clerk_user_id != clerk_user_id)
            .limit(1)
        )
        if email_owner is not None:
            await db.rollback()
            raise BootstrapRefused("Bootstrap refused: the verified email is attached to another local identity.")
        if user is not None and (
            user.clerk_deleted_at is not None or user.status != AccountStatus.ACTIVE.value
        ):
            await db.rollback()
            raise BootstrapRefused("Bootstrap refused: the local identity is deleted or suspended.")

        previous_role = user.role if user is not None else "none"
        if user is None:
            user = User(
                clerk_user_id=clerk_user_id,
                email=email,
                first_name=provider_data.get("first_name") or None,
                last_name=provider_data.get("last_name") or None,
                display_name=user_service.build_display_name(provider_data),
                role=Role.SUPERADMIN.value,
                status=AccountStatus.ACTIVE.value,
                permissions=[],
            )
            db.add(user)
        else:
            user.email = email
            user.role = Role.SUPERADMIN.value
            user.permissions = []

        await db.flush()
        db.add(
            ActivityLog(
                user_id=None,
                owner_id=user.id,
                audience=ActivityAudience.USER_MANAGEMENT.value,
                action=ActivityAction.PROMOTED.value,
                resource=ActivityResource.USER.value,
                resource_id=user.id,
                details={
                    "from": previous_role,
                    "to": Role.SUPERADMIN.value,
                    "source": "bootstrap_superadmin.py",
                },
            )
        )
        await db.commit()
        return user.id


async def main() -> None:
    try:
        await bootstrap_first_superadmin(parse_email())
    except BootstrapRefused as exc:
        sys.exit(str(exc))
    except Exception as exc:
        sys.exit("Bootstrap failed. Check database connectivity and configuration, then try again.")
    print("First active superadmin bootstrap completed.")


if __name__ == "__main__":
    asyncio.run(main())
