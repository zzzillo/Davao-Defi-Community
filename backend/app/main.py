import asyncio
import sys

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import get_db

from app.routers.admin import router as admin_router
from app.routers.events import router as events_router
from app.routers.users import router as users_router
from app.routers.webhooks import router as webhooks_router

if sys.platform == "win32":
    # psycopg's async driver refuses to run on Windows' default ProactorEventLoop.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

app = FastAPI()

app.include_router(admin_router)
app.include_router(events_router)
app.include_router(users_router)
app.include_router(webhooks_router)

# The Vite dev server is a different origin, and the Authorization header makes
# requests preflighted, so the browser needs these headers back on OPTIONS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": result.scalar(),
    }

@app.get("/auth_test")
async def auth_test(
    current_user: CurrentUser = Depends(get_current_user),
):
    # Reports the authorization the token itself carries, so a misconfigured
    # session claim shows up here instead of as a mystery 403 later.
    return {
        "authenticated": True,
        "clerk_user_id": current_user.clerk_user_id,
        "role": current_user.role,
        "permissions": sorted(current_user.permissions),
    }

if __name__ == "__main__":
    import uvicorn

    # uvicorn creates its own loop from a factory and ignores the policy set above,
    # so name the factory explicitly instead of letting it pick ProactorEventLoop.
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        loop="asyncio:SelectorEventLoop" if sys.platform == "win32" else "auto",
    )
