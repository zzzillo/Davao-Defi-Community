from fastapi import APIRouter, Depends

from app.auth.dependencies import CurrentUser, require_admin

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)


@router.get("/ping")
async def admin_ping(
    current_user: CurrentUser = Depends(require_admin),
):
    """Smallest possible admin-only endpoint.

    The gate is the whole point: the body assumes it is talking to an admin
    because it cannot be reached any other way.
    """
    return {
        "ok": True,
        "clerk_user_id": current_user.clerk_user_id,
        "role": current_user.role,
    }
