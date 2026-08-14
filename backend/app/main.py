import asyncio
import sys

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_clerk_user
from app.database import get_db

if sys.platform == "win32":
    # psycopg's async driver refuses to run on Windows' default ProactorEventLoop.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

app = FastAPI()

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
    clerk_state=Depends(get_current_clerk_user),
):
    return {
        "authenticated": True,
        "clerk_user_id": clerk_state.payload["sub"],
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
