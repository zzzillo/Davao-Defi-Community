import logging
import os
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from clerk_backend_api import authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions

from app.auth.permissions import (
    Permission,
    Role,
    has_permission,
    parse_permissions,
    parse_role,
    role_at_least,
)

logger = logging.getLogger(__name__)


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
