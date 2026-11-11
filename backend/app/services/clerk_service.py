"""Clerk client for identity-side operations.

Clerk verifies account identity. Application roles and status live in
PostgreSQL and are never mirrored into or read from Clerk metadata.
"""

from functools import lru_cache

from clerk_backend_api import Clerk
from clerk_backend_api.utils.retries import BackoffStrategy, RetryConfig

from app.config import get_settings


@lru_cache(maxsize=1)
def get_clerk() -> Clerk:
    """One client per process, so its HTTP connection pool gets reused.

    Built on first call rather than at import, so a script can load its .env
    before anything reads CLERK_SECRET_KEY.
    """
    secret_key = get_settings().clerk_secret_key
    if not secret_key:
        raise RuntimeError("CLERK_SECRET_KEY is not configured")
    return Clerk(bearer_auth=secret_key)


def no_automatic_retries() -> RetryConfig:
    """Avoid silently replaying non-idempotent invitation writes."""
    return RetryConfig(
        strategy="none",
        backoff=BackoffStrategy(
            initial_interval=1,
            max_interval=1,
            exponent=1,
            max_elapsed_time=1,
        ),
        retry_connection_errors=False,
    )


async def get_clerk_user(clerk_user_id: str):
    """Fetch the canonical Clerk identity, including its primary email id."""
    return await get_clerk().users.get_async(user_id=clerk_user_id)


async def find_verified_clerk_user_by_primary_email(email: str):
    """Resolve one Clerk identity by its exact, verified primary email."""
    from app.services.user_service import _dict, verified_primary_email

    matches = await get_clerk().users.list_async(
        request={"email_address": [email.strip().lower()], "limit": 10}
    )
    exact = [
        user
        for user in matches
        if verified_primary_email(_dict(user)) == email.strip().lower()
    ]
    if len(exact) > 1:
        raise ValueError("Multiple Clerk users have that verified primary email")
    return exact[0] if exact else None


async def find_clerk_invitation(invitation_id: str):
    """Look up one provider invitation by its exact ID across lifecycle states."""
    invitations = get_clerk().invitations
    for status in (None, "revoked"):
        matches = await invitations.list_async(
            query=invitation_id,
            status=status,
            limit=10,
            offset=0,
        )
        exact = next((item for item in matches if item.id == invitation_id), None)
        if exact is not None:
            return exact
    return None


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
