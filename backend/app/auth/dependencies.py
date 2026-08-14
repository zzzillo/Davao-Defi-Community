import logging
import os

from fastapi import HTTPException, Request
from clerk_backend_api import authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions

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
