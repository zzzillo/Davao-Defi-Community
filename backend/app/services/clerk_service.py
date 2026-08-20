"""Writes to Clerk.

The one module that reads CLERK_SECRET_KEY. Every change to a person's
authorization passes through here, so there is a single place to audit and a
single place a mistake could live.
"""

import logging
import os
from collections.abc import Iterable
from functools import lru_cache

from clerk_backend_api import Clerk

from app.auth.permissions import Permission, Role

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_clerk() -> Clerk:
    """One client per process, so its HTTP connection pool gets reused.

    Built on first call rather than at import, so a script can load its .env
    before anything reads CLERK_SECRET_KEY.
    """
    return Clerk(bearer_auth=os.environ["CLERK_SECRET_KEY"])


def build_public_metadata(
    role: Role,
    permissions: Iterable[Permission] = (),
) -> dict:
    """Shape publicMetadata for a role, enforcing the invariants in one place.

    Only officials carry a permission list. Admin implies everything and a member
    is allowed nothing, so storing a list for either would be a lie the admin UI
    would then display back as fact.
    """
    stored = (
        sorted(permission.value for permission in permissions)
        if role is Role.OFFICIAL
        else []
    )

    return {"role": role.value, "permissions": stored}


async def set_user_authorization(
    clerk_user_id: str,
    role: Role,
    permissions: Iterable[Permission] = (),
) -> dict:
    """Write role and permissions to Clerk publicMetadata.

    Takes typed Role and Permission rather than strings, so an invalid role
    cannot reach Clerk in the first place.

    Clerk errors are deliberately not caught here. A failed authorization write
    must never be reported to the caller as a success.

    Returns the metadata that was written, so the local mirror can be updated
    from the exact same values.
    """
    metadata = build_public_metadata(role, permissions)

    # update_metadata is a PATCH: keys not named here survive untouched. Both
    # keys are therefore always written together - sending only {"role": "member"}
    # on a demotion would leave the old permissions array sitting in Clerk.
    await get_clerk().users.update_metadata_async(
        user_id=clerk_user_id,
        public_metadata=metadata,
    )

    logger.info("Set authorization for %s: %s", clerk_user_id, metadata)

    return metadata


async def find_clerk_user_id(identifier: str) -> str | None:
    """Resolve an email address to a Clerk user id. Passes ids through unchanged."""
    if identifier.startswith("user_"):
        return identifier

    users = await get_clerk().users.list_async(
        request={"email_address": [identifier], "limit": 2}
    )

    if not users:
        return None

    if len(users) > 1:
        raise ValueError(f"{identifier} matches more than one Clerk user")

    return users[0].id
