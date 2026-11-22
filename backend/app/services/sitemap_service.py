"""Build the public sitemap from published content.

Only content the public API would serve to an anonymous visitor is listed:
published articles, event galleries and RSVPs, and contributors who opted into
the directory. Drafts never appear, because a sitemap is a public index of
addresses and an unpublished address is not public.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import quote
from xml.sax.saxutils import escape

from sqlalchemy import Select, select, text

from app.database import AsyncSessionLocal
from app.models.blog import Blog
from app.models.event import Event
from app.models.post import Post
from app.models.user import User
from app.services import slug_service, user_service

SITE_URL = "https://davaodeficommunity.com"
# Vercel caches the rewritten response for an hour, so newly published content
# appears in the sitemap within that window.
SITEMAP_CACHE_CONTROL = "public, max-age=0, s-maxage=3600"
STATIC_PATHS = ("/", "/events", "/blogs", "/contributors", "/partners", "/join-us")
# A sitemap file holds at most 50,000 URLs; four kinds at this cap stay under it.
MAX_URLS_PER_KIND = 10_000


@dataclass(frozen=True)
class SitemapEntry:
    path: str
    lastmod: datetime | None = None


def _segment(value: object) -> str:
    return quote(str(value), safe="")


def titled_path(prefix: str, item_id: object, title: str | None) -> str:
    """/events/<id>/<title-slug>, matching frontend/src/utils/publicPaths.ts.

    The slug is derived from the title with the same slugify the frontend
    uses, so the sitemap lists the address the page declares as canonical.
    A title with no ASCII letters or digits gives the bare /<prefix>/<id>.
    """
    path = f"{prefix}/{_segment(item_id)}"
    slug = slug_service.slugify(title or "")
    return f"{path}/{slug}" if slug else path


def published_blogs_query() -> Select:
    return (
        select(Blog.slug, Blog.updated_at)
        .where(Blog.published.is_(True))
        .order_by(Blog.published_at.desc(), Blog.id)
        .limit(MAX_URLS_PER_KIND)
    )


def published_posts_query() -> Select:
    return (
        select(Post.id, Post.title, Post.updated_at)
        .where(Post.published.is_(True))
        .order_by(Post.post_date.desc(), Post.id)
        .limit(MAX_URLS_PER_KIND)
    )


def published_events_query() -> Select:
    return (
        select(Event.id, Event.title, Event.updated_at)
        .where(Event.published.is_(True))
        .order_by(Event.start_datetime.desc(), Event.id)
        .limit(MAX_URLS_PER_KIND)
    )


def public_contributors_query() -> Select:
    return (
        select(User.public_slug)
        .where(*user_service.public_contributor_conditions())
        .order_by(User.public_slug)
        .limit(MAX_URLS_PER_KIND)
    )


async def collect_entries() -> list[SitemapEntry]:
    """Read every public address in one read-only snapshot of the database."""
    async with AsyncSessionLocal() as db, db.begin():
        await db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
        blogs = (await db.execute(published_blogs_query())).all()
        posts = (await db.execute(published_posts_query())).all()
        events = (await db.execute(published_events_query())).all()
        contributors = (await db.execute(public_contributors_query())).scalars().all()

    return [
        *(SitemapEntry(path) for path in STATIC_PATHS),
        *(SitemapEntry(f"/blog/{_segment(slug)}", updated) for slug, updated in blogs),
        *(SitemapEntry(titled_path("/events", post_id, title), updated) for post_id, title, updated in posts),
        *(SitemapEntry(titled_path("/rsvp", event_id, title), updated) for event_id, title, updated in events),
        *(SitemapEntry(f"/contributors/{_segment(slug)}") for slug in contributors),
    ]


def render_sitemap(entries: Iterable[SitemapEntry]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for entry in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(SITE_URL + entry.path)}</loc>")
        if entry.lastmod is not None:
            lastmod = entry.lastmod.astimezone(timezone.utc).date().isoformat()
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"
