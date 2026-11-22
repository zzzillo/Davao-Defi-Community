"""Public sitemap, served on the site's domain through a Vercel rewrite."""

from fastapi import APIRouter, Depends, HTTPException, Response

from app.security.rate_limits import limit_public_read
from app.services.sitemap_service import SITEMAP_CACHE_CONTROL, collect_entries, render_sitemap

router = APIRouter(tags=["SEO"])


@router.get("/sitemap.xml", dependencies=[Depends(limit_public_read)], include_in_schema=False)
async def get_sitemap():
    try:
        entries = await collect_entries()
    except Exception as error:
        # Do not let a database failure become a cached, empty sitemap.
        raise HTTPException(
            status_code=503,
            detail="Sitemap is temporarily unavailable",
            headers={"Cache-Control": "no-store"},
        ) from error

    return Response(
        content=render_sitemap(entries),
        media_type="application/xml",
        headers={"Cache-Control": SITEMAP_CACHE_CONTROL},
    )
