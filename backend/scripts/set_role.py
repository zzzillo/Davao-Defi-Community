"""Demote an existing application's user role directly in PostgreSQL.

Run from the backend directory:

    .venv/bin/python scripts/set_role.py you@example.com member
    .venv/bin/python scripts/set_role.py user_123 official

Clerk is used for identity verification at request time. This break-glass
script may only lower an existing role; it cannot grant or bootstrap access.
Use the admin API for ordinary promotions and bootstrap_superadmin.py for the
single explicit first-superadmin setup.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.getcwd())

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), ".env"))

from sqlalchemy import func, or_, select, text

from app.auth.permissions import Role, is_role_demotion, parse_role, role_at_least
from app.auth.locks import USER_MUTATION_LOCK_KEY
from app.database import AsyncSessionLocal
from app.models.activity_log import ActivityAction, ActivityAudience, ActivityLog, ActivityResource
from app.models.user import AccountStatus, User



def parse_args() -> tuple[str, Role]:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    identifier = sys.argv[1]
    try:
        role = Role(sys.argv[2])
    except ValueError:
        valid = ", ".join(value.value for value in Role)
        sys.exit(f"Unknown role {sys.argv[2]!r}. Valid roles: {valid}")
    return identifier, role


async def main() -> None:
    identifier, role = parse_args()
    async with AsyncSessionLocal() as db:
        await db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": USER_MUTATION_LOCK_KEY})
        user = await db.scalar(
            select(User)
            .where(or_(User.clerk_user_id == identifier, User.email == identifier))
            .with_for_update()
        )
        if user is None:
            sys.exit(f"No local user found for {identifier!r}")

        previous = parse_role(user.role)
        if role is not previous and not is_role_demotion(previous, role):
            sys.exit("Role elevation is not supported by this script.")
        if previous is Role.SUPERADMIN and user.status == AccountStatus.ACTIVE.value and role is not Role.SUPERADMIN:
            active_superadmins = await db.scalar(
                select(func.count()).select_from(User).where(
                    User.role == Role.SUPERADMIN.value,
                    User.status == AccountStatus.ACTIVE.value,
                )
            ) or 0
            if active_superadmins <= 1:
                sys.exit("Cannot remove the last active superadmin.")

        print(f"user    {user.clerk_user_id}")
        print(f"before  role={user.role!r} status={user.status!r}")
        if role is not previous:
            user.role = role.value
            user.permissions = []
            db.add(
                ActivityLog(
                    user_id=None,
                    owner_id=user.id,
                    audience=ActivityAudience.USER_MANAGEMENT.value,
                    action=(ActivityAction.PROMOTED if role_at_least(role, previous) else ActivityAction.DEMOTED).value,
                    resource=ActivityResource.USER.value,
                    resource_id=user.id,
                    details={
                        "display_name": user.display_name,
                        "from": previous.value,
                        "to": role.value,
                        "source": "set_role.py",
                    },
                )
            )
            await db.commit()
        else:
            await db.rollback()
        print(f"after   role={user.role!r} status={user.status!r}\n")


asyncio.run(main())
