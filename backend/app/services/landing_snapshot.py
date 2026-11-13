"""Publish the public landing page from committed PostgreSQL data to R2."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from contextlib import closing, suppress
from datetime import datetime, timezone
from html.parser import HTMLParser
from uuid import uuid4

from botocore.exceptions import ClientError
from sqlalchemy import func, select, text

from app.database import AsyncSessionLocal
from app.models.blog import Blog
from app.models.event import Event
from app.models.partner import Partner
from app.models.post import Post
from app.models.post_image import PostImage
from app.models.user import User
from app.services import storage_service, user_service
from app.services.landing_media import SnapshotMedia, is_missing_object, snapshot_media
from app.services.realtime import ResourceChangeHub

logger = logging.getLogger(__name__)
SNAPSHOT_KEY = "landing/v1/snapshot.json"
SNAPSHOT_CACHE_CONTROL = "public, max-age=0, s-maxage=45"


class _PreviewParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _preview(value: str | None) -> str:
    parser = _PreviewParser()
    parser.feed(value or "")
    parser.close()
    plain = " ".join(" ".join(parser.parts).split())
    return plain if len(plain) <= 300 else plain[:300].rstrip() + "..."


async def project_snapshot() -> tuple[dict, datetime | None]:
    """Read the same public slices and totals as the landing page used to show."""
    async with AsyncSessionLocal() as db, db.begin():
        await db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
        now = await db.scalar(select(func.now()))
        partner_count = await db.scalar(select(func.count()).select_from(Partner))
        photo_event_count = await db.scalar(
            select(func.count()).select_from(Post).where(Post.published.is_(True))
        )
        contributor_count = await db.scalar(
            select(func.count()).select_from(User).where(*user_service.public_contributor_conditions())
        )

        partners = (await db.execute(
            select(Partner.id, Partner.name, Partner.logo_key)
            .order_by(Partner.display_order, Partner.id).limit(100)
        )).all()

        public_events = select(
            Event.id, Event.title, Event.description, Event.location,
            Event.start_datetime, Event.end_datetime, Event.banner_image_key,
        ).where(Event.published.is_(True))
        featured = (await db.execute(
            public_events.where(Event.start_datetime >= now).order_by(Event.start_datetime, Event.id).limit(1)
        )).first()
        next_start = featured.start_datetime if featured else None

        cover = (
            select(PostImage.image_key).where(PostImage.post_id == Post.id)
            .order_by(PostImage.display_order, PostImage.id).limit(1).scalar_subquery()
        )
        recaps = (await db.execute(
            select(
                Post.id, Post.title, Post.description, Post.location, Post.post_date,
                cover.label("cover"),
            )
            .where(Post.published.is_(True)).order_by(Post.post_date.desc(), Post.created_at.desc(), Post.id).limit(4)
        )).all()
        articles = (await db.execute(
            select(
                Blog.id, Blog.slug, Blog.title, Blog.excerpt, Blog.published_at,
                Blog.updated_at, Blog.cover_image_key, User.display_name,
            )
            .outerjoin(User, User.id == Blog.creator_id).where(Blog.published.is_(True))
            .order_by(Blog.published_at.desc(), Blog.created_at.desc(), Blog.id).limit(3)
        )).all()

    snapshot = {
        "version": 1,
        "partners": [
            {"id": str(row.id), "name": row.name, "image": row.logo_key} for row in partners
        ],
        "event": None if featured is None else {
            "id": str(featured.id), "title": featured.title, "description": _preview(featured.description),
            "location": featured.location, "start_datetime": featured.start_datetime.isoformat(),
            "end_datetime": featured.end_datetime.isoformat() if featured.end_datetime else None,
            "kind": "upcoming", "image": featured.banner_image_key,
        },
        "recaps": [
            {
                "id": str(row.id),
                "title": row.title or "Untitled Event",
                "description": _preview(row.description), "location": row.location,
                "post_date": row.post_date.isoformat(), "image": row.cover,
            } for row in recaps
        ],
        "articles": [
            {
                "id": str(row.id), "slug": row.slug, "title": row.title, "excerpt": _preview(row.excerpt),
                "author": row.display_name, "published_at": row.published_at.isoformat() if row.published_at else None,
                "updated_at": row.updated_at.isoformat() if not row.published_at else None,
                "image": row.cover_image_key,
            } for row in articles
        ],
        "stats": {"events": photo_event_count, "contributors": contributor_count, "partners": partner_count},
    }
    return snapshot, next_start


def _read_snapshot(media: SnapshotMedia) -> tuple[bytes, str | None]:
    try:
        response = media.client.get_object(Bucket=media.bucket, Key=SNAPSHOT_KEY)
    except ClientError as error:
        if is_missing_object(error):
            return b"", None
        raise
    with closing(response["Body"]) as body:
        return body.read(), response["ETag"]


async def read_published_snapshot() -> bytes | None:
    """Read the published snapshot through authenticated R2 access."""
    media = snapshot_media(storage_service.get_r2_client(), storage_service.get_r2_bucket())
    body, _ = await asyncio.to_thread(_read_snapshot, media)
    return body or None


def _write_snapshot(media: SnapshotMedia, snapshot: dict, existing: bytes, etag: str | None) -> None:
    cards_and_widths = (
        (snapshot["partners"], (176, 352)),
        ([snapshot["event"]] if snapshot["event"] else [], (480, 960)),
        (snapshot["recaps"], (480, 960)),
        (snapshot["articles"], (320, 640)),
    )
    for cards, widths in cards_and_widths:
        for card in cards:
            card["image"] = media.image(card["image"], widths)

    try:
        current = json.loads(existing) if existing else None
    except ValueError:
        current = None
    if isinstance(current, dict):
        current.pop("revision", None)
        if current == snapshot:
            return

    # Give each publication a distinct ETag even when an edit restores earlier content.
    body = json.dumps(
        {**snapshot, "revision": uuid4().hex}, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode()
    # A conflicted write is retried from a fresh database read by the publisher.
    condition = {"IfNoneMatch": "*"} if etag is None else {"IfMatch": etag}
    media.client.put_object(
        Bucket=media.bucket, Key=SNAPSHOT_KEY, Body=body, ContentType="application/json",
        CacheControl=SNAPSHOT_CACHE_CONTROL, **condition,
    )
    logger.info("Published landing snapshot (%d bytes)", len(body))


async def publish_snapshot() -> datetime | None:
    media = snapshot_media(storage_service.get_r2_client(), storage_service.get_r2_bucket())
    # Read the ETag before opening the database snapshot to fence older publishers.
    existing, etag = await asyncio.to_thread(_read_snapshot, media)
    snapshot, next_start = await project_snapshot()
    await asyncio.to_thread(_write_snapshot, media, snapshot, existing, etag)
    return next_start


async def run_snapshot_publisher(
    hub: ResourceChangeHub,
    publish: Callable[[], Awaitable[datetime | None]] = publish_snapshot,
    *,
    debounce: float = 1,
    retry_delay: float = 2,
) -> None:
    subscription = hub.subscribe()
    delay = retry_delay
    try:
        while True:
            # Drain a batch before reading. Changes during the read or upload
            # stay queued for the following pass.
            with suppress(asyncio.QueueEmpty):
                while True:
                    subscription.get_nowait()
            try:
                next_start = await publish()
            except Exception as error:
                reason = type(error).__name__
                if isinstance(error, ClientError):
                    reason = error.response.get("Error", {}).get("Code", reason)
                logger.warning("Landing snapshot publish failed (%s); retrying", reason)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)
                continue

            delay = retry_delay
            timeout = None if next_start is None else max(
                0, (next_start - datetime.now(timezone.utc)).total_seconds() + 0.01,
            )
            try:
                await asyncio.wait_for(subscription.get(), timeout)
            except TimeoutError:
                continue
            await asyncio.sleep(debounce)
    finally:
        hub.unsubscribe(subscription)
