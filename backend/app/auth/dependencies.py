import logging
from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from clerk_backend_api import authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings, validate_clerk_issuer_url
from app.models.user import User
from app.models.user import AccountStatus
from app.services.user_service import get_by_clerk_id
from app.auth.permissions import Permission, Role, has_permission, parse_role, role_at_least

logger = logging.getLogger(__name__)

# Clerk's code for "no token was presented at all", as opposed to one that was
# presented and refused.
NO_TOKEN = "session-token-missing"


def get_current_clerk_user(request: Request):
    secret_key = get_settings().clerk_secret_key
    try:
        issuer_url = validate_clerk_issuer_url(get_settings().clerk_issuer_url)
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail={"reason": "clerk_configuration_invalid", "message": str(exc)},
        ) from exc
    if not secret_key:
        raise HTTPException(
            status_code=503,
            detail={"reason": "clerk_not_configured"},
        )

    request_state = authenticate_request(
        request,
        AuthenticateRequestOptions(
            secret_key=secret_key,
            # Matched exactly against the token's azp claim, which is a bare
            # origin - no trailing slash, no path.
            authorized_parties=list(get_settings().allowed_origins),
            accepts_token=["session_token"],
        ),
    )

    if not request_state.is_authenticated:
        reason = request_state.reason
        code = reason.value[0] if reason is not None else "unknown"

        # A request carrying no token is normal for public routes. Keep that
        # case quiet while logging tokens Clerk rejected as warnings.
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

    # clerk_backend_api verifies against the instance-specific JWKS selected by
    # CLERK_SECRET_KEY, but its current API intentionally skips `iss` validation.
    # Keep an explicit issuer binding so a token from another Clerk instance is
    # rejected even if an operator accidentally wires the wrong browser app.
    if request_state.payload.get("iss", "").rstrip("/") != issuer_url:
        raise HTTPException(
            status_code=401,
            detail={"reason": "token_issuer_mismatch", "message": "Not authenticated"},
        )

    return request_state


@dataclass(frozen=True)
class CurrentUser:
    """Verified identity with current authorization from the application row.

    Frozen on purpose: a route handler must not be able to hand itself a
    different role partway through a request.
    """

    clerk_user_id: str
    role: Role
    user_id: UUID

    def can(self, required: Permission) -> bool:
        """For decisions inside a handler, when the whole route isn't being gated."""
        return has_permission(self.role, required)


async def _load_active_user(db: AsyncSession, clerk_user_id: str) -> User:
    """Load and validate the local account identified by a verified subject."""
    user = await get_by_clerk_id(db, clerk_user_id)

    if user is None:
        # The Clerk webhook creates this row. Missing means the webhook has not
        # arrived or failed, and the honest answer is that the request cannot be
        # completed in the system's current state - not 404, since the thing the
        # caller asked for is not what is missing.
        #
        # Deliberately not created on the spot: the JWT carries no profile data,
        # and webhook sync owns initial row creation.
        logger.warning("No local row for %s", clerk_user_id)

        raise HTTPException(
            status_code=409,
            detail={
                "reason": "profile_not_synced",
                "message": "Your profile has not finished syncing. Try again shortly.",
            },
        )

    if user.clerk_deleted_at is not None:
        raise HTTPException(
            status_code=403,
            detail={
                "reason": "clerk_identity_deleted",
                "message": "This Clerk identity is no longer available. Contact an administrator.",
            },
        )

    if user.status != AccountStatus.ACTIVE.value:
        raise HTTPException(
            status_code=403,
            detail={
                "reason": "account_suspended",
                "message": "This account is inactive. Contact an administrator.",
            },
        )

    return user


async def get_current_db_user(
    clerk_state=Depends(get_current_clerk_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Load the active local account identified by the verified Clerk subject."""
    return await _load_active_user(db, clerk_state.payload["sub"])


async def get_current_user(
    user: User = Depends(get_current_db_user),
) -> CurrentUser:
    """Turn the current database row into an authorization decision object."""
    return CurrentUser(
        clerk_user_id=user.clerk_user_id,
        role=parse_role(user.role),
        user_id=user.id,
    )


async def get_stream_current_user(
    clerk_state=Depends(get_current_clerk_user),
    # The SSE response can live far longer than authentication. Release this
    # session after the endpoint returns its response, before body streaming.
    db: AsyncSession = Depends(get_db, scope="function"),
) -> CurrentUser:
    """Resolve the current user with function-scoped DB cleanup for streams."""
    user = await _load_active_user(db, clerk_state.payload["sub"])
    return CurrentUser(
        clerk_user_id=user.clerk_user_id,
        role=parse_role(user.role),
        user_id=user.id,
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
    """Build a gate from the fixed cumulative module role map."""

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
