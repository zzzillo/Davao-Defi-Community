import asyncio
import io
import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock, patch

from botocore.exceptions import ClientError
from PIL import Image

from app.services import realtime, storage_service


def empty_snapshot() -> dict:
    return {
        "version": 1, "partners": [], "event": None, "recaps": [], "articles": [],
        "stats": {"events": 0, "contributors": 0, "partners": 0},
    }


def missing_object(operation: str) -> ClientError:
    return ClientError({"Error": {"Code": "NoSuchKey"}}, operation)


class LandingSnapshotTests(unittest.IsolatedAsyncioTestCase):
    async def test_changes_during_publish_coalesce_into_a_followup_snapshot(self):
        from app.services.landing_snapshot import run_snapshot_publisher

        hub = realtime.ResourceChangeHub()
        started = asyncio.Event()
        finish = asyncio.Event()
        refreshed = asyncio.Event()
        publications = 0

        async def publish():
            nonlocal publications
            publications += 1
            if publications == 1:
                started.set()
                await finish.wait()
            else:
                refreshed.set()

        task = asyncio.create_task(run_snapshot_publisher(hub, publish, debounce=0.005))
        try:
            await asyncio.wait_for(started.wait(), timeout=1)
            for resource in ("posts", "events", "partners", "posts"):
                await hub.publish(resource)
            finish.set()
            await asyncio.wait_for(refreshed.wait(), timeout=1)
            self.assertEqual(publications, 2)
        finally:
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task

    async def test_publisher_retries_failed_write_and_refreshes_when_event_starts(self):
        from app.services.landing_snapshot import run_snapshot_publisher

        hub = realtime.ResourceChangeHub()
        next_start = datetime.now(timezone.utc) + timedelta(seconds=0.05)
        publish = AsyncMock(side_effect=[OSError(), next_start, None])
        task = asyncio.create_task(run_snapshot_publisher(hub, publish, debounce=0.005, retry_delay=0.005))
        try:
            async with asyncio.timeout(2):
                while publish.await_count < 3:
                    await asyncio.sleep(0.005)
            self.assertEqual(publish.await_count, 3)
        finally:
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertEqual(hub.subscriber_count, 0)

    async def test_snapshot_uses_the_original_etag_and_never_retries_a_stale_body(self):
        from app.services.landing_snapshot import publish_snapshot

        client = Mock()
        client.get_object.return_value = {"Body": io.BytesIO(b"{}"), "ETag": '"before"'}
        client.put_object.side_effect = ClientError({"Error": {"Code": "PreconditionFailed"}}, "PutObject")
        projection = AsyncMock(return_value=(empty_snapshot(), None))
        with (
            patch.object(storage_service, "get_r2_client", return_value=client),
            patch.object(storage_service, "get_r2_bucket", return_value="bucket"),
            patch("app.services.landing_snapshot.project_snapshot", projection),
        ):
            with self.assertRaises(ClientError):
                await publish_snapshot()
        client.put_object.assert_called_once()
        self.assertEqual(client.put_object.call_args.kwargs["IfMatch"], '"before"')

    async def test_new_snapshot_has_short_cdn_ttl_and_skips_unchanged_content(self):
        from app.services.landing_snapshot import publish_snapshot

        client = Mock()
        client.get_object.side_effect = missing_object("GetObject")
        projection = AsyncMock(return_value=(empty_snapshot(), None))
        with (
            patch.object(storage_service, "get_r2_client", return_value=client),
            patch.object(storage_service, "get_r2_bucket", return_value="bucket"),
            patch("app.services.landing_snapshot.project_snapshot", projection),
        ):
            await publish_snapshot()
            write = client.put_object.call_args.kwargs
            client.get_object.side_effect = None
            client.get_object.return_value = {"Body": io.BytesIO(write["Body"]), "ETag": '"first"'}
            await publish_snapshot()
        self.assertEqual(write["Key"], "landing/v1/snapshot.json")
        self.assertEqual(write["IfNoneMatch"], "*")
        self.assertEqual(write["CacheControl"], "public, max-age=0, s-maxage=45")
        client.put_object.assert_called_once()

    async def test_reverting_an_edit_does_not_restore_an_old_snapshot_etag(self):
        from app.services.landing_snapshot import publish_snapshot

        client = Mock()
        original = empty_snapshot()
        edited = {**empty_snapshot(), "stats": {"events": 1, "contributors": 0, "partners": 0}}
        projection = AsyncMock(side_effect=[(original, None), (edited, None), (original, None)])
        client.get_object.side_effect = missing_object("GetObject")
        with (
            patch.object(storage_service, "get_r2_client", return_value=client),
            patch.object(storage_service, "get_r2_bucket", return_value="bucket"),
            patch("app.services.landing_snapshot.project_snapshot", projection),
        ):
            await publish_snapshot()
            first_body = client.put_object.call_args.kwargs["Body"]
            client.get_object.side_effect = None
            client.get_object.return_value = {"Body": io.BytesIO(first_body), "ETag": '"first"'}
            await publish_snapshot()
            second_body = client.put_object.call_args.kwargs["Body"]
            client.get_object.return_value = {"Body": io.BytesIO(second_body), "ETag": '"second"'}
            await publish_snapshot()
            reverted_body = client.put_object.call_args.kwargs["Body"]

        self.assertNotEqual(first_body, reverted_body)
        self.assertEqual(json.loads(first_body)["stats"], json.loads(reverted_body)["stats"])
        self.assertEqual(client.put_object.call_args.kwargs["IfMatch"], '"second"')


class LandingImageTests(unittest.TestCase):
    def test_resize_preserves_alpha_and_deduplicates_widths_without_upscaling(self):
        from app.services.landing_media import SnapshotMedia

        source = io.BytesIO()
        Image.new("RGBA", (240, 120), (10, 20, 30, 128)).save(source, format="PNG")
        client = Mock()
        client.head_object.side_effect = missing_object("HeadObject")
        client.get_object.return_value = {"Body": io.BytesIO(source.getvalue())}
        with patch.object(storage_service, "get_public_base_url", return_value="https://media.example.test"):
            media = SnapshotMedia(client, "bucket")
            result = media.image("partners/example/logo.png", (176, 352))
            self.assertEqual(media.image("partners/example/logo.png", (176, 352)), result)
            client.head_object.side_effect = [{"Metadata": {"width": "176"}}, {"Metadata": {"width": "240"}}]
            restarted = SnapshotMedia(client, "bucket")
            self.assertEqual(restarted.image("partners/example/logo.png", (176, 352)), result)
        self.assertEqual([variant["width"] for variant in result["variants"]], [176, 240])
        self.assertEqual(client.get_object.call_count, 1)
        for call, width in zip(client.put_object.call_args_list, (176, 240), strict=True):
            with Image.open(io.BytesIO(call.kwargs["Body"])) as resized:
                self.assertEqual(resized.size, (width, width // 2))
                self.assertEqual(resized.getpixel((0, 0))[3], 128)
