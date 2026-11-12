"""Authenticated server-sent events for resource cache invalidation."""

import asyncio
import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.auth.dependencies import CurrentUser, get_stream_current_user
from app.services.realtime import ResourceChangeHub
from app.security.rate_limits import limit_realtime

router = APIRouter(prefix="/realtime", tags=["realtime"])


def get_resource_change_hub(request: Request) -> ResourceChangeHub:
    hub = getattr(request.app.state, "realtime_hub", None)
    if hub is None:
        # ASGI test transports do not necessarily run the app lifespan. The
        # production lifespan always installs a shared process-level instance.
        hub = ResourceChangeHub()
        request.app.state.realtime_hub = hub
    return hub


async def stream_resource_changes(
    request: Request,
    current_user: CurrentUser = Depends(get_stream_current_user, scope="function"),
) -> StreamingResponse:
    """Stream resource names only; no row IDs, payloads, or auth details."""
    del current_user  # Authentication is the purpose of the dependency.
    hub = get_resource_change_hub(request)
    queue = hub.subscribe()

    async def events():
        try:
            yield ": connected\n\n"
            while True:
                try:
                    resource = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    if await request.is_disconnected():
                        break
                    yield ": keep-alive\n\n"
                    continue

                # Resource names are an allowlisted enum, and serialization is
                # intentionally limited to this one field.
                payload = json.dumps({"resource": resource}, separators=(",", ":"))
                yield f"event: resource_changed\ndata: {payload}\n\n"
                if await request.is_disconnected():
                    break
        finally:
            hub.unsubscribe(queue)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


router.add_api_route(
    "/events",
    stream_resource_changes,
    methods=["GET"],
    response_class=StreamingResponse,
    summary="Subscribe to authenticated resource change notifications",
    dependencies=[Depends(limit_realtime)],
)
