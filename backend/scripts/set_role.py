"""Set a user's role and permissions directly, bypassing the API.

Every admin endpoint requires an existing admin, so the first admin cannot be
made through the API. This makes it. It is also the break-glass tool for the day
you lock yourself out.

Run from the backend/ directory:

    .venv/Scripts/python scripts/set_role.py you@example.com admin
    .venv/Scripts/python scripts/set_role.py user_123 official events.create blogs.create
    .venv/Scripts/python scripts/set_role.py you@example.com member
"""

import asyncio
import os
import sys

# Scripts run with their own directory on sys.path, not the working directory,
# so the "from app.…" imports below need this.
sys.path.insert(0, os.getcwd())

if sys.platform == "win32":
    # psycopg's async driver refuses to run on Windows' default ProactorEventLoop.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), ".env"))

from sqlalchemy import select

from app.auth.permissions import Permission, Role
from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.clerk_service import find_clerk_user_id, set_user_authorization
from app.services.user_service import apply_authorization_to_mirror


def parse_args() -> tuple[str, Role, list[Permission]]:
    """Validate arguments before anything touches Clerk.

    Fails loudly on a bad value, unlike parse_role which fails closed. That is
    the right trade in opposite directions: untrusted metadata should degrade to
    least privilege, but a typo here silently demoting someone to member would be
    far worse than an error message.
    """
    if len(sys.argv) < 3:
        sys.exit(__doc__)

    identifier = sys.argv[1]

    try:
        role = Role(sys.argv[2])
    except ValueError:
        valid = ", ".join(role.value for role in Role)
        sys.exit(f"Unknown role {sys.argv[2]!r}. Valid roles: {valid}")

    permissions = []

    for name in sys.argv[3:]:
        try:
            permissions.append(Permission(name))
        except ValueError:
            valid = ", ".join(p.value for p in Permission)
            sys.exit(f"Unknown permission {name!r}.\nValid permissions: {valid}")

    if permissions and role is not Role.OFFICIAL:
        sys.exit(f"Only officials carry permissions; {role.value} ignores them.")

    return identifier, role, permissions


async def main() -> None:
    identifier, role, permissions = parse_args()

    clerk_user_id = await find_clerk_user_id(identifier)

    if clerk_user_id is None:
        sys.exit(f"No Clerk user found for {identifier!r}")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.clerk_user_id == clerk_user_id)
        )
        before = result.scalar_one_or_none()

        print(f"\nuser    {clerk_user_id}")

        if before is None:
            print("before  (no local row yet)")
        else:
            print(f"before  role={before.role!r} permissions={before.permissions!r}")

        # Clerk first - it is what the gates actually read. The mirror follows,
        # so it can never claim a promotion that Clerk did not accept.
        metadata = await set_user_authorization(clerk_user_id, role, permissions)
        await apply_authorization_to_mirror(db, clerk_user_id, metadata)

        print(f"after   role={metadata['role']!r} permissions={metadata['permissions']!r}\n")


asyncio.run(main())
