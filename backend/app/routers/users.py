from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_clerk_user
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    clerk_state=Depends(get_current_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    clerk_user_id = clerk_state.payload["sub"]

    result = await db.execute(
        select(User).where(
            User.clerk_user_id == clerk_user_id
        )
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User profile not found",
        )

    return user