import logging
import os
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from clerk_backend_api import authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.user_service import get_by_clerk_id
from app.auth.permissions import (
    Permission,
    Role,
    has_permission,
    parse_permissions,
    parse_role,
    role_at_least,
)

logger = logging.getLogger(__name__)

# Clerk's code for "no token was presented at all", as opposed to one that was
# presented and refused.
NO_TOKEN = "session-token-missing"


def get_current_clerk_user(request: Request):
    request_state = authenticate_request(
        request,
        AuthenticateRequestOptions(
            secret_key=os.environ["CLERK_SECRET_KEY"],
            # Matched exactly against the token's azp claim, which is a bare
            # origin - no trailing slash, no path.
            authorized_parties=[
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ],
            accepts_token=["session_token"],
        ),
    )

    if not request_state.is_authenticated:
        reason = request_state.reason
        code = reason.value[0] if reason is not None else "unknown"

        # A request carrying no token is the normal case now that the site has
        # public pages - get_optional_user calls straight into here and expects
        # this 401 for every anonymous visitor. Logging that at warning level
        # would fill the log with ordinary traffic and bury the case that
        # actually means something: a token that *was* presented and refused,
        # which points at an expired session, a wrong authorized party, or a
        # misconfigured key.
        if code == NO_TOKEN:
            logger.debug("Anonymous request to %s", request.url.path)
        else:
            logger.warning("Clerk auth rejected: %s - %s", code, request_state.message)

        raise HTTPException(
            status_code=401,
            detail={
                "reason": code,
                "message": request_state.message or "Not authenticated",
            },
        )

    return request_state


@dataclass(frozen=True)
class CurrentUser:
    """Everything an endpoint needs to know about its caller, read from the JWT.

    Frozen on purpose: a route handler must not be able to hand itself a
    different role partway through a request.
    """

    clerk_user_id: str
    role: Role
    permissions: frozenset[Permission]

    def can(self, required: Permission) -> bool:
        """For decisions inside a handler, when the whole route isn't being gated."""
        return has_permission(self.role, self.permissions, required)


def get_current_user(
    clerk_state=Depends(get_current_clerk_user),
) -> CurrentUser:
    """Turn a verified token into an authorization decision object.

    Builds on get_current_clerk_user rather than re-verifying: that dependency
    answers "is this really you?", this one answers "what may you do?". Keeping
    them apart means the signature checking has exactly one home.

    Nothing here queries the database. The role travels inside the signed token,
    so authorization costs no network call and no SQL.
    """
    payload = clerk_state.payload

    metadata = payload.get("metadata")

    if not isinstance(metadata, dict):
        # Absent because the custom session claim isn't configured, or the
        # publicMetadata was hand-edited into something that isn't an object.
        # Either way an empty dict sends both parsers down their safe path.
        metadata = {}

    return CurrentUser(
        clerk_user_id=payload["sub"],
        role=parse_role(metadata.get("role")),
        permissions=parse_permissions(metadata.get("permissions")),
    )


def get_optional_user(request: Request) -> CurrentUser | None:
    """The caller if there is one, None if the request is anonymous.

    For endpoints that serve everybody but show more to some people - a public
    list that also carries drafts for whoever may see them. get_current_user
    cannot do this: it answers "who are you?" with a 401, which is the right
    answer for a protected route and the wrong one for a public page.

    Only a rejected token becomes None. A malformed one is still allowed to
    fail loudly, because that is a broken client rather than an absent visitor.
    """
    try:
        clerk_state = get_current_clerk_user(request)
    except HTTPException:
        return None

    return get_current_user(clerk_state)


async def get_current_db_user(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """The caller's row in our own database, not just their token.

    Authorization above this line stays free of SQL - the role rides inside the
    signed token. This dependency is a different question: routes that must
    *store* who acted need the local UUID, because clerk_user_id is not what
    our foreign keys point at.

    Pull it in only where a route actually writes ownership. Every route that
    uses it pays for one SELECT.
    """
    user = await get_by_clerk_id(db, current_user.clerk_user_id)

    if user is None:
        # The Clerk webhook creates this row. Missing means the webhook has not
        # arrived or failed, and the honest answer is that the request cannot be
        # completed in the system's current state - not 404, since the thing the
        # caller asked for is not what is missing.
        #
        # Deliberately not created on the spot: the JWT carries no name or email,
        # so an invented row would have a wrong display_name that the next
        # user.updated would silently overwrite.
        logger.warning("No local row for %s", current_user.clerk_user_id)

        raise HTTPException(
            status_code=409,
            detail={
                "reason": "profile_not_synced",
                "message": "Your profile has not finished syncing. Try again shortly.",
            },
        )

    return user


def assert_may_see_drafts(
    current_user: CurrentUser | None,
    required: Permission,
    *,
    noun: str,
) -> None:
    """Gate the include_drafts flag on a list route that is otherwise public.

    Not a Depends() gate, and it cannot be one: the whole route is open to
    anonymous callers, and only one query parameter needs permission. A
    dependency runs before the handler and does not know what was asked for.

    Written once here rather than three times in three routers, because this is
    the exact shape mistakes hide in. Events and Posts each carried their own
    copy of these twenty lines, and Blogs would have made three - three places
    for a future change to be applied twice.

    401 and 403 answer different questions and the frontend reacts to each
    differently: unknown identity means send them to sign in, known identity
    means show them what to ask an admin for. Collapsing both into one status
    would make the sign-in prompt appear for somebody already signed in.

    Raises rather than returning a bool, so a caller cannot forget to check the
    answer. `if may_see_drafts(...)` that silently does nothing on False is a
    leak; this has no falsy path to ignore.
    """
    if current_user is None:
        raise HTTPException(
            status_code=401,
            detail={
                "reason": "authentication_required",
                "message": f"Sign in to view unpublished {noun}",
            },
        )

    if not current_user.can(required):
        raise HTTPException(
            status_code=403,
            detail={
                "reason": "missing_permission",
                # Named so the frontend can say what to ask an admin for.
                "required_permission": required.value,
            },
        )


def require_role(minimum: Role):
    """Build a gate that admits anyone ranked at `minimum` or above.

    This outer function runs once, when the route is declared. What FastAPI runs
    on every request is the inner `dependency` it returns - the enum lookup and
    the closure happen at import time, not per call.
    """

    def dependency(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if not role_at_least(current_user.role, minimum):
            raise HTTPException(
                status_code=403,
                detail={
                    "reason": "insufficient_role",
                    "required_role": minimum.value,
                },
            )

        return current_user

    return dependency


def require_permission(required: Permission):
    """Build a gate that admits anyone holding `required` (admins always do)."""

    def dependency(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if not current_user.can(required):
            raise HTTPException(
                status_code=403,
                detail={
                    "reason": "missing_permission",
                    # Named so the frontend can say what to ask an admin for.
                    "required_permission": required.value,
                },
            )

        return current_user

    return dependency


# Named gates. Routes then read as intent, and every guarded endpoint in the
# project is one `grep "require_"` away.
#
# require_member is get_current_user itself: a valid token is all "member" means,
# and an invalid one already became a 401 before this point.
require_member = get_current_user
require_official = require_role(Role.OFFICIAL)
require_admin = require_role(Role.ADMIN)
