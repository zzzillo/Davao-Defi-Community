"""Public cached data used by the landing page."""

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse

from app.security.rate_limits import limit_public_read
from app.services import storage_service
from app.services.landing_snapshot import (
    SNAPSHOT_CACHE_CONTROL,
    project_snapshot,
    read_published_snapshot,
)

router = APIRouter(tags=["Landing"])


@router.get("/landing/v1/snapshot.json", dependencies=[Depends(limit_public_read)])
async def get_landing_snapshot():
    """Serve the R2 snapshot through the backend's authenticated R2 client."""
    try:
        body = await read_published_snapshot()
    except Exception as error:
        # Do not let an infrastructure failure become a cacheable response.
        raise HTTPException(
            status_code=503,
            detail="Landing snapshot is temporarily unavailable",
            headers={"Cache-Control": "no-store"},
        ) from error

    if body is None:
        raise HTTPException(
            status_code=503,
            detail="Landing snapshot is temporarily unavailable",
            headers={"Cache-Control": "no-store"},
        )

    return Response(
        content=body,
        media_type="application/json",
        headers={"Cache-Control": SNAPSHOT_CACHE_CONTROL},
    )


def _image_for_fallback(key: str | None) -> dict | None:
    url = storage_service.resolve_public_url(key)
    if not url:
        return None
    return {"src": url, "variants": []}


@router.get("/landing/v1/fallback.json", dependencies=[Depends(limit_public_read)])
async def get_landing_fallback():
    """Build landing data from PostgreSQL without reading or writing R2."""
    try:
        snapshot, _ = await project_snapshot()
        for partner in snapshot["partners"]:
            partner["image"] = _image_for_fallback(partner["image"])
        if snapshot["event"] is not None:
            snapshot["event"]["image"] = _image_for_fallback(snapshot["event"]["image"])
        for card in (*snapshot["recaps"], *snapshot["articles"]):
            card["image"] = _image_for_fallback(card["image"])
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Landing updates are temporarily unavailable",
            headers={"Cache-Control": "no-store"},
        ) from error

    return JSONResponse(content=snapshot, headers={"Cache-Control": "no-store"})
