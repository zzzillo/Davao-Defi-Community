from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, Request
from svix.webhooks import Webhook

from app.security.request_limits import RequestBodyLimitMiddleware
from app.security.request_limits import WEBHOOK_REQUEST_BODY_LIMIT
from app.services.media_service import MAX_UPLOAD_BYTES


class RequestBodyLimitTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.app = FastAPI()
        self.app.add_middleware(
            RequestBodyLimitMiddleware,
            default_limit=64,
            webhook_limit=WEBHOOK_REQUEST_BODY_LIMIT,
            exempt_paths={"/media/uploads"},
        )
        self.json_calls = 0

        @self.app.post("/json")
        async def echo_json(payload: dict):
            self.json_calls += 1
            return {"payload": payload}

        @self.app.post("/webhooks/clerk")
        async def webhook(request: Request):
            body = await request.body()
            Webhook(self.secret).verify(body, dict(request.headers))
            return {"verified": True}

        @self.app.post("/media/uploads")
        async def upload(request: Request):
            return {"size": len(await request.body())}

        self.secret = "whsec_dGVzdC1rZXk="

    async def async_client(self):
        return httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app),
            base_url="http://test",
        )

    async def test_declared_oversize_rejected_before_route_reads_body(self) -> None:
        async with await self.async_client() as client:
            response = await client.post(
                "/json",
                content=b"{" + b" " * 64 + b"}",
                headers={"content-type": "application/json"},
            )
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["detail"]["reason"], "request_body_too_large")
        self.assertEqual(self.json_calls, 0)

    async def test_oversize_stream_without_content_length_stops_during_read(self) -> None:
        delivered = 0

        async def chunks():
            nonlocal delivered
            for chunk in (b'{"x":"', b"a" * 40, b"b" * 40, b'"}'):
                delivered += len(chunk)
                yield chunk

        async with await self.async_client() as client:
            response = await client.post(
                "/json",
                content=chunks(),
                headers={"content-type": "application/json"},
            )
        self.assertEqual(response.status_code, 413, response.text)
        self.assertEqual(response.json()["detail"]["reason"], "request_body_too_large")
        self.assertLess(delivered, 100, "middleware should stop requesting chunks once over limit")
        self.assertEqual(self.json_calls, 0)

    async def test_oversize_stream_with_false_small_content_length_is_rejected(self) -> None:
        async def chunks():
            for chunk in (b'{"x":"', b"a" * 40, b"b" * 40, b'"}'):
                yield chunk

        async with await self.async_client() as client:
            response = await client.post(
                "/json",
                content=chunks(),
                headers={
                    "content-type": "application/json",
                    "content-length": "1",
                },
            )
        self.assertEqual(response.status_code, 413, response.text)
        self.assertEqual(response.json()["detail"]["reason"], "request_body_too_large")
        self.assertEqual(self.json_calls, 0)

    async def test_bounded_json_body_reaches_validation(self) -> None:
        async with await self.async_client() as client:
            response = await client.post("/json", json={"ok": True})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"payload": {"ok": True}})
        self.assertEqual(self.json_calls, 1)

    async def test_bounded_signed_webhook_payload_still_verifies(self) -> None:
        body = json.dumps(
            {"type": "ping", "payload": "x" * 900_000}, separators=(",", ":")
        )
        webhook = Webhook(self.secret)
        event_id = "msg_body_limit_test"
        timestamp = datetime.now(timezone.utc)
        signature = webhook.sign(event_id, timestamp, body)
        headers = {
            "svix-id": event_id,
            "svix-timestamp": str(int(timestamp.timestamp())),
            "svix-signature": signature,
            "content-type": "application/json",
        }
        async with await self.async_client() as client:
            response = await client.post("/webhooks/clerk", content=body, headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"verified": True})

    async def test_upload_path_keeps_its_own_larger_streaming_limit(self) -> None:
        self.assertEqual(WEBHOOK_REQUEST_BODY_LIMIT, 1024 * 1024)
        self.assertEqual(MAX_UPLOAD_BYTES, 10 * 1024 * 1024)
        body = b"x" * 100
        async with await self.async_client() as client:
            response = await client.post("/media/uploads", content=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"size": len(body)})


if __name__ == "__main__":
    unittest.main()
