"""Process-local fanout for PostgreSQL resource change notifications."""

from __future__ import annotations

import asyncio
import logging
import json

from psycopg import AsyncConnection
from sqlalchemy.engine import make_url

logger = logging.getLogger(__name__)

RESOURCE_NAMES = frozenset({"events", "posts", "blogs", "partners", "users"})
NOTIFICATION_CHANNEL = "ddc_resource_changes"


def resolve_listener_url(
    database_url: str | None,
    explicit_listener_url: str | None = None,
) -> str | None:
    """Return a psycopg URL for LISTEN, preferring an explicit direct URL.

    Neon pooler endpoints accept LISTEN as SQL but do not guarantee session
    affinity, so the notification registration can disappear before events are
    delivered. Their direct endpoint uses the same credentials and database;
    removing the ``-pooler.`` hostname label keeps app writes on the pooler.
    Other providers can supply ``DATABASE_LISTEN_URL`` explicitly.
    """
    raw_url = explicit_listener_url or database_url
    if not raw_url:
        return None

    try:
        url = make_url(raw_url.strip())
    except Exception as exc:
        raise ValueError("database listener URL is invalid") from exc
    if url.drivername in {"postgres", "postgresql", "postgresql+psycopg"}:
        url = url.set(drivername="postgresql")
    else:
        raise ValueError("database listener URL must use PostgreSQL")

    if explicit_listener_url is None and url.host and "-pooler." in url.host:
        url = url.set(host=url.host.replace("-pooler.", ".", 1))

    return url.render_as_string(hide_password=False)


def parse_resource_notification(payload: str) -> str | None:
    """Accept only the allowlisted resource name, with no row data."""
    try:
        event = json.loads(payload)
    except (TypeError, json.JSONDecodeError):
        return None
    if not isinstance(event, dict) or set(event) != {"resource"}:
        return None
    resource = event.get("resource")
    return resource if isinstance(resource, str) and resource in RESOURCE_NAMES else None


class ResourceChangeSubscription:
    """Coalesce pending names while retaining every distinct invalidation."""

    def __init__(self) -> None:
        self._pending_resources: set[str] = set()
        self._available = asyncio.Event()

    def offer(self, resource: str) -> None:
        if resource not in self._pending_resources:
            self._pending_resources.add(resource)
            self._available.set()

    async def get(self) -> str:
        while not self._pending_resources:
            self._available.clear()
            await self._available.wait()
        return self.get_nowait()

    def get_nowait(self) -> str:
        if not self._pending_resources:
            raise asyncio.QueueEmpty
        resource = self._pending_resources.pop()
        if not self._pending_resources:
            self._available.clear()
        return resource


class ResourceChangeHub:
    """Process-local fanout with one pending slot per resource and client."""

    def __init__(self) -> None:
        self._subscribers: set[ResourceChangeSubscription] = set()

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def subscribe(self) -> ResourceChangeSubscription:
        subscription = ResourceChangeSubscription()
        self._subscribers.add(subscription)
        return subscription

    def unsubscribe(self, subscription: ResourceChangeSubscription) -> None:
        self._subscribers.discard(subscription)

    async def publish(self, resource: str) -> None:
        if resource not in RESOURCE_NAMES:
            return
        for subscription in tuple(self._subscribers):
            subscription.offer(resource)


async def run_notification_listener(
    hub: ResourceChangeHub,
    database_url: str | None,
    explicit_listener_url: str | None = None,
) -> None:
    """Keep one PostgreSQL session per app process and fan out its events.

    The task is cancelled by FastAPI lifespan shutdown. Connection failures use
    bounded exponential backoff; SSE clients can remain connected and receive
    heartbeats until the listener reconnects.
    """
    try:
        listener_url = resolve_listener_url(database_url, explicit_listener_url)
    except ValueError as exc:
        logger.error("PostgreSQL resource listener is disabled: %s", exc)
        return
    if not listener_url:
        logger.info("PostgreSQL resource listener is disabled: database is not configured")
        return

    delay = 1.0
    while True:
        try:
            connection = await AsyncConnection.connect(
                listener_url,
                connect_timeout=8,
                autocommit=True,
            )
            async with connection:
                await connection.execute(f"LISTEN {NOTIFICATION_CHANNEL}")
                logger.info("PostgreSQL resource listener connected")
                delay = 1.0
                # NOTIFY events are not retained while this session is down.
                # Once LISTEN is active again, refresh every resource for
                # browsers whose HTTP SSE connection stayed open during the
                # database listener outage.
                for resource_name in RESOURCE_NAMES:
                    await hub.publish(resource_name)
                async for notification in connection.notifies():
                    resource = parse_resource_notification(notification.payload)
                    if resource:
                        await hub.publish(resource)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # Avoid logging a driver exception's connection string or payload.
            logger.warning(
                "PostgreSQL resource listener disconnected (%s); retrying",
                type(exc).__name__,
            )
        await asyncio.sleep(delay)
        delay = min(delay * 2, 30.0)
