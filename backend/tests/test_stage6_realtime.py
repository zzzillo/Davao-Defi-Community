"""Stage 6 realtime unit and guarded integration checks."""

import asyncio
import os
import unittest
from types import SimpleNamespace
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from dotenv import dotenv_values, load_dotenv
from psycopg import AsyncConnection
from sqlalchemy.engine import make_url

from app.services.realtime import (
    RESOURCE_NAMES,
    ResourceChangeHub,
    parse_resource_notification,
    resolve_listener_url,
)


class RealtimeHubTests(unittest.IsolatedAsyncioTestCase):
    async def test_published_changes_reach_only_active_subscribers(self) -> None:
        hub = ResourceChangeHub()
        first = hub.subscribe()
        second = hub.subscribe()

        await hub.publish("events")
        self.assertEqual(first.get_nowait(), "events")
        self.assertEqual(second.get_nowait(), "events")

        hub.unsubscribe(first)
        await hub.publish("blogs")
        self.assertEqual(second.get_nowait(), "blogs")
        with self.assertRaises(asyncio.QueueEmpty):
            first.get_nowait()
        self.assertEqual(hub.subscriber_count, 1)

    async def test_pending_changes_coalesce_duplicates_without_dropping_resources(self) -> None:
        hub = ResourceChangeHub()
        subscriber = hub.subscribe()

        for resource in sorted(RESOURCE_NAMES):
            await hub.publish(resource)
        for _ in range(100):
            await hub.publish("events")

        received = []
        while True:
            try:
                received.append(subscriber.get_nowait())
            except asyncio.QueueEmpty:
                break

        self.assertEqual(set(received), set(RESOURCE_NAMES))
        self.assertEqual(len(received), len(RESOURCE_NAMES))


class NotificationListenerTests(unittest.IsolatedAsyncioTestCase):
    async def test_listener_retries_connects_and_closes_session_on_cancel(self) -> None:
        from app.services import realtime

        hub = ResourceChangeHub()
        subscriber = hub.subscribe()
        connection = Mock()
        connection.execute = AsyncMock()
        connection.__aenter__ = AsyncMock(return_value=connection)
        connection.__aexit__ = AsyncMock(return_value=None)
        connected_again = asyncio.Event()
        attempts = 0

        async def notifications():
            yield SimpleNamespace(payload='{"resource":"events"}')
            await asyncio.Event().wait()

        connection.notifies = Mock(side_effect=lambda: notifications())
        original_sleep = asyncio.sleep

        async def fast_retry_sleep(_delay: float) -> None:
            await original_sleep(0)

        async def connect(_url: str, **_kwargs):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise OSError("test connection failure")
            connected_again.set()
            return connection

        with (
            patch.object(realtime.AsyncConnection, "connect", new=AsyncMock(side_effect=connect)) as connect_mock,
            patch.object(realtime.asyncio, "sleep", new=fast_retry_sleep),
        ):
            task = asyncio.create_task(
                realtime.run_notification_listener(
                    hub,
                    "postgresql://listener:secret@db-direct.example.test/app",
                )
            )
            await asyncio.wait_for(connected_again.wait(), timeout=1)
            resync_resources = {
                await asyncio.wait_for(subscriber.get(), timeout=1)
                for _ in RESOURCE_NAMES
            }
            self.assertEqual(resync_resources, set(RESOURCE_NAMES))
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task

        self.assertEqual(connect_mock.await_count, 2)
        connection.execute.assert_awaited_once_with("LISTEN ddc_resource_changes")
        connection.__aexit__.assert_awaited_once()

    async def test_fastapi_lifespan_cancels_listener_task_on_shutdown(self) -> None:
        from app import main

        started = asyncio.Event()
        stopped = asyncio.Event()

        async def fake_listener(_hub, _database_url, _listener_url):
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                stopped.set()

        with patch.object(main, "run_notification_listener", new=fake_listener):
            async with main.lifespan(main.app):
                await asyncio.wait_for(started.wait(), timeout=1)

        self.assertTrue(stopped.is_set())


class NotificationPayloadTests(unittest.TestCase):
    def test_only_known_resource_only_payloads_are_accepted(self) -> None:
        for resource in RESOURCE_NAMES:
            with self.subTest(resource=resource):
                self.assertEqual(
                    parse_resource_notification(f'{{"resource":"{resource}"}}'),
                    resource,
                )

        self.assertIsNone(parse_resource_notification('{"resource":"activity"}'))
        self.assertIsNone(
            parse_resource_notification('{"resource":"events","id":"private"}')
        )
        self.assertIsNone(parse_resource_notification("not-json"))


class ListenerUrlTests(unittest.TestCase):
    def test_pooled_neon_database_url_resolves_to_direct_listener_host(self) -> None:
        pooled = "postgresql+psycopg://listener:secret@ep-frosty-pooler.c-9.aws.neon.tech/neondb"

        resolved = make_url(resolve_listener_url(pooled))

        self.assertEqual(resolved.drivername, "postgresql")
        self.assertEqual(resolved.host, "ep-frosty.c-9.aws.neon.tech")
        self.assertEqual(resolved.database, "neondb")
        self.assertEqual(resolved.password, "secret")

    def test_explicit_listener_url_is_used_without_rewriting(self) -> None:
        explicit = "postgresql://listener:secret@db-direct.example.test/app"

        resolved = resolve_listener_url(
            "postgresql+psycopg://writer:secret@db-pooler.example.test/app",
            explicit,
        )

        self.assertEqual(resolved, explicit)

    def test_listener_url_is_disabled_without_a_database_url(self) -> None:
        self.assertIsNone(resolve_listener_url(None))


class SSEEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_stream_sends_resource_only_events_and_unsubscribes_on_close(self) -> None:
        from app.auth.dependencies import CurrentUser
        from app.routers.realtime import stream_resource_changes

        hub = ResourceChangeHub()
        request = Mock()
        request.app.state.realtime_hub = hub
        current_user = CurrentUser(
            clerk_user_id="clerk-user",
            role=Mock(value="admin"),
            user_id=Mock(),
        )
        response = await stream_resource_changes(request, current_user)
        body = response.body_iterator

        self.assertEqual(response.media_type, "text/event-stream")
        self.assertEqual(response.headers["cache-control"], "no-cache, no-transform")
        self.assertEqual(response.headers["x-accel-buffering"], "no")
        connected = await anext(body)
        queue = next(iter(hub._subscribers))
        await hub.publish("posts")
        changed = await anext(body)
        await body.aclose()

        self.assertEqual(connected, ": connected\n\n")
        self.assertEqual(
            changed,
            'event: resource_changed\ndata: {"resource":"posts"}\n\n',
        )
        self.assertEqual(hub.subscriber_count, 0)

    async def test_stream_endpoint_requires_current_user_dependency(self) -> None:
        import httpx
        from fastapi import HTTPException, Request

        from app.auth.dependencies import get_stream_current_user
        from app.main import app

        async def require_test_bearer(request: Request):
            if request.headers.get("authorization") != "Bearer valid-test-token":
                raise HTTPException(status_code=401, detail={"reason": "not_authenticated"})
            return Mock()

        app.dependency_overrides[get_stream_current_user] = require_test_bearer
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://testserver"
            ) as client:
                response = await client.get("/realtime/events")
            self.assertEqual(response.status_code, 401, response.text)
        finally:
            app.dependency_overrides.clear()

    def test_auth_database_session_is_finalized_before_streaming_begins(self) -> None:
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.auth.dependencies import get_current_clerk_user
        from app.database import get_db
        from app.models.user import AccountStatus, User
        from app.routers.realtime import router as realtime_router

        app = FastAPI()
        app.include_router(realtime_router)
        hub = ResourceChangeHub()
        app.state.realtime_hub = hub
        session_finalized = asyncio.Event()

        async def fake_clerk_identity():
            return SimpleNamespace(payload={"sub": "clerk-test-user"})

        async def fake_db_session():
            try:
                yield object()
            finally:
                session_finalized.set()

        app.dependency_overrides[get_current_clerk_user] = fake_clerk_identity
        app.dependency_overrides[get_db] = fake_db_session
        user = User(
            id=uuid4(),
            clerk_user_id="clerk-test-user",
            display_name="Test User",
            role="admin",
            status=AccountStatus.ACTIVE.value,
        )

        try:
            with patch("app.auth.dependencies.get_by_clerk_id", new=AsyncMock(return_value=user)):
                with TestClient(app) as client:
                    with client.stream("GET", "/realtime/events") as response:
                        self.assertEqual(response.status_code, 200)
                        first_chunk = next(response.iter_text())
                        self.assertIn(": connected", first_chunk)
                        self.assertTrue(session_finalized.is_set())
        finally:
            app.dependency_overrides.clear()


@unittest.skipUnless(
    os.getenv("RUN_STAGE6_LIVE_TESTS") == "true",
    "set RUN_STAGE6_LIVE_TESTS=true to opt in to guarded test database trigger tests",
)
class Stage6LiveTriggerTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        from app.config import validate_test_database_url
        from app.services.realtime import resolve_listener_url

        backend_dir = Path(__file__).resolve().parents[1]
        load_dotenv(backend_dir / ".env", override=False)
        values = dotenv_values(backend_dir / ".env.test")
        test_url = values.get("TEST_DATABASE_URL")
        if not test_url:
            raise RuntimeError("backend/.env.test must set TEST_DATABASE_URL")
        os.environ["ALLOW_REMOTE_TEST_DATABASE"] = str(
            values.get("ALLOW_REMOTE_TEST_DATABASE", "false")
        )
        validate_test_database_url(str(test_url))
        cls.test_url = str(test_url)
        cls.listen_url = resolve_listener_url(cls.test_url)
        if not cls.listen_url:
            raise RuntimeError("the guarded test database must have a listener URL")

    async def asyncSetUp(self) -> None:
        self.prefix = f"stage6-{uuid4().hex[:12]}"
        self.actor_id = uuid4()
        self.resource_ids = {table: uuid4() for table in (
            "users", "events", "posts", "blogs", "partners", "user_invitations"
        )}
        self.writer = await AsyncConnection.connect(self.test_url, connect_timeout=10)
        async with self.writer.cursor() as cursor:
            await cursor.execute(
                "INSERT INTO users (id, clerk_user_id, display_name) VALUES (%s, %s, %s)",
                (self.actor_id, f"{self.prefix}-actor", self.prefix),
            )
        await self.writer.commit()

    async def asyncTearDown(self) -> None:
        try:
            async with self.writer.cursor() as cursor:
                await cursor.execute("DELETE FROM user_invitations WHERE email LIKE %s", (f"{self.prefix}%",))
                await cursor.execute("DELETE FROM posts WHERE title LIKE %s", (f"{self.prefix}%",))
                await cursor.execute("DELETE FROM blogs WHERE slug LIKE %s", (f"{self.prefix}%",))
                await cursor.execute("DELETE FROM partners WHERE name LIKE %s", (f"{self.prefix}%",))
                await cursor.execute("DELETE FROM events WHERE title LIKE %s", (f"{self.prefix}%",))
                await cursor.execute("DELETE FROM users WHERE clerk_user_id LIKE %s", (f"{self.prefix}%",))
            await self.writer.commit()
        finally:
            await self.writer.close()

    async def test_create_update_delete_notify_only_the_resource_after_commit(self) -> None:
        from app.services.realtime import NOTIFICATION_CHANNEL

        listener = await AsyncConnection.connect(self.listen_url, connect_timeout=10, autocommit=True)
        await listener.execute(f"LISTEN {NOTIFICATION_CHANNEL}")

        records = [
            ("users", "users", "INSERT INTO users (id, clerk_user_id, display_name) VALUES (%s, %s, %s)", (self.resource_ids["users"], f"{self.prefix}-user", self.prefix), "UPDATE users SET display_name = %s WHERE id = %s", (f"{self.prefix}-updated", self.resource_ids["users"])),
            ("events", "events", "INSERT INTO events (id, title, start_datetime, creator_id) VALUES (%s, %s, %s, %s)", (self.resource_ids["events"], self.prefix, datetime.now(timezone.utc), self.actor_id), "UPDATE events SET title = %s WHERE id = %s", (f"{self.prefix}-updated", self.resource_ids["events"])),
            ("posts", "posts", "INSERT INTO posts (id, title, post_date, creator_id) VALUES (%s, %s, %s, %s)", (self.resource_ids["posts"], self.prefix, datetime.now(timezone.utc).date(), self.actor_id), "UPDATE posts SET title = %s WHERE id = %s", (f"{self.prefix}-updated", self.resource_ids["posts"])),
            ("blogs", "blogs", "INSERT INTO blogs (id, title, slug, creator_id) VALUES (%s, %s, %s, %s)", (self.resource_ids["blogs"], self.prefix, f"{self.prefix}-slug", self.actor_id), "UPDATE blogs SET title = %s WHERE id = %s", (f"{self.prefix}-updated", self.resource_ids["blogs"])),
            ("partners", "partners", "INSERT INTO partners (id, name, creator_id) VALUES (%s, %s, %s)", (self.resource_ids["partners"], self.prefix, self.actor_id), "UPDATE partners SET name = %s WHERE id = %s", (f"{self.prefix}-updated", self.resource_ids["partners"])),
            ("users", "user_invitations", "INSERT INTO user_invitations (id, email, invited_by_user_id) VALUES (%s, %s, %s)", (self.resource_ids["user_invitations"], f"{self.prefix}@example.test", self.actor_id), "UPDATE user_invitations SET status = 'failed' WHERE id = %s", (self.resource_ids["user_invitations"],)),
        ]

        try:
            for index, (resource, table, insert, insert_args, update, update_args) in enumerate(records):
                with self.subTest(table=table):
                    async with self.writer.cursor() as cursor:
                        await cursor.execute(insert, insert_args)
                    # PostgreSQL delivers NOTIFY only after the transaction commits.
                    if index == 0:
                        pending = [note async for note in listener.notifies(timeout=0.15, stop_after=1)]
                        self.assertEqual(pending, [])
                    await self.writer.commit()
                    self.assertEqual(await self.next_notification(listener), resource)

                    async with self.writer.cursor() as cursor:
                        await cursor.execute(update, update_args)
                    await self.writer.commit()
                    self.assertEqual(await self.next_notification(listener), resource)

                    async with self.writer.cursor() as cursor:
                        await cursor.execute(f"DELETE FROM {table} WHERE id = %s", (self.resource_ids[table],))
                    await self.writer.commit()
                    self.assertEqual(await self.next_notification(listener), resource)
        finally:
            await listener.close()

    @staticmethod
    async def next_notification(listener: AsyncConnection) -> str:
        from app.services.realtime import parse_resource_notification

        notifications = [note async for note in listener.notifies(timeout=3, stop_after=1)]
        if len(notifications) != 1:
            raise AssertionError("timed out waiting for a committed resource notification")
        resource = parse_resource_notification(notifications[0].payload)
        if not resource:
            raise AssertionError("received a notification with a non-resource payload")
        return resource


if __name__ == "__main__":
    unittest.main()
