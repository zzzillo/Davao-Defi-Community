import asyncio
import logging
import sys
from contextlib import asynccontextmanager, suppress
from typing import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, get_current_user
from app.config import Settings, get_settings
from app.database import get_db

from app.routers.activity_logs import router as activity_logs_router
from app.routers.admin import router as admin_router
from app.routers.blogs import router as blogs_router
from app.routers.events import router as events_router
from app.routers.media import router as media_router
from app.routers.partners import router as partners_router
from app.routers.posts import router as posts_router
from app.routers.realtime import router as realtime_router
from app.routers.users import router as users_router
from app.routers.webhooks import router as webhooks_router
from app.services.landing_snapshot import run_snapshot_publisher
from app.services.realtime import ResourceChangeHub, run_notification_listener
from app.security.rate_limits import RateLimiter
from app.security.request_limits import RequestBodyLimitMiddleware

if sys.platform == "win32":
    # psycopg's async driver refuses to run on Windows' default ProactorEventLoop.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logger = logging.getLogger(__name__)

settings = get_settings()


def create_rate_limiter(config: Settings) -> RateLimiter:
    """Create production limiter state only when its shared store is present."""
    requires_shared_store = config.requires_shared_rate_limit_store
    if requires_shared_store and not config.rate_limit_redis_url:
        raise RuntimeError("RATE_LIMIT_REDIS_URL is required in production and on Render")
    return RateLimiter.from_url(
        config.rate_limit_redis_url,
        require_shared_store=requires_shared_store,
    )


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    limiter = create_rate_limiter(settings)
    application.state.rate_limiter = limiter
    if settings.rate_limit_redis_url is None:
        logger.warning("RATE_LIMIT_REDIS_URL is not configured; shared rate limiting is unavailable")
    hub = ResourceChangeHub()
    application.state.realtime_hub = hub
    tasks = [asyncio.create_task(
        run_notification_listener(
            hub,
            settings.database_url,
            settings.database_listen_url,
        ),
        name="postgres-resource-listener",
    )]
    if settings.landing_snapshot_enabled:
        tasks.append(asyncio.create_task(run_snapshot_publisher(hub), name="landing-snapshot-publisher"))
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with suppress(asyncio.CancelledError):
                await task
        await limiter.close()


app = FastAPI(lifespan=lifespan)


# Registered before CORSMiddleware on purpose. Middleware added later wraps
# middleware added earlier, so declaring this first leaves it *inside* the CORS
# layer - which is the whole point.
#
# Starlette's own 500 handler sits outside that layer, so an unhandled exception
# reaches the browser with no Access-Control-Allow-Origin header. The browser
# then reports "blocked by CORS policy" and says nothing about the real error,
# which sends you looking at CORS configuration that was never broken.
@app.middleware("http")
async def report_unhandled_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        # exception() keeps the full traceback in the server log. Only the
        # response is made vague - an error message can leak table names, file
        # paths, and query fragments to whoever triggered it.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)

        return JSONResponse(
            status_code=500,
            content={
                "detail": {
                    "reason": "internal_error",
                    "message": "Something went wrong on the server",
                }
            },
        )


# Limit request bodies before FastAPI's JSON or webhook parsing. This pure ASGI
# middleware only counts chunks as the app consumes them; it does not buffer a
# second copy of the request. The media upload route has its own 10 MB stream cap.
app.add_middleware(RequestBodyLimitMiddleware)


app.include_router(activity_logs_router)
app.include_router(admin_router)
app.include_router(blogs_router)
app.include_router(events_router)
app.include_router(media_router)
app.include_router(partners_router)
app.include_router(posts_router)
app.include_router(realtime_router)
app.include_router(users_router)
app.include_router(webhooks_router)

# The Vite dev server is a different origin, and the Authorization header makes
# requests preflighted, so the browser needs these headers back on OPTIONS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check(
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.exception("Database health check failed")
        raise HTTPException(
            status_code=503,
            detail={"reason": "database_unavailable"},
        ) from exc

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
