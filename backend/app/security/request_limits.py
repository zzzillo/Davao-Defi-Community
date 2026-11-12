"""Streaming ASGI request-body size limits for API routes."""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

DEFAULT_REQUEST_BODY_LIMIT = 1024 * 1024
WEBHOOK_REQUEST_BODY_LIMIT = 1024 * 1024
UPLOAD_PATH = "/media/uploads"


class RequestBodyLimitMiddleware:
    """Enforce a declared and streamed limit without consuming/buffering twice."""

    def __init__(
        self,
        app,
        *,
        default_limit: int = DEFAULT_REQUEST_BODY_LIMIT,
        webhook_limit: int = WEBHOOK_REQUEST_BODY_LIMIT,
        exempt_paths: Iterable[str] = (UPLOAD_PATH,),
    ) -> None:
        if default_limit < 1 or webhook_limit < 1:
            raise ValueError("request body limits must be positive")
        self.app = app
        self.default_limit = default_limit
        self.webhook_limit = webhook_limit
        self.exempt_paths = frozenset(exempt_paths)

    def _limit_for(self, scope: dict[str, Any]) -> int | None:
        path = scope.get("path", "")
        if path in self.exempt_paths:
            return None
        if path == "/webhooks/clerk":
            return self.webhook_limit
        return self.default_limit

    @staticmethod
    async def _respond(send, status_code: int, reason: str) -> None:
        body = json.dumps({"detail": {"reason": reason}}, separators=(",", ":")).encode()
        await send(
            {
                "type": "http.response.start",
                "status": status_code,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body, "more_body": False})

    async def __call__(self, scope, receive, send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        if scope.get("method", "GET").upper() not in {"POST", "PUT", "PATCH", "DELETE"}:
            await self.app(scope, receive, send)
            return

        limit = self._limit_for(scope)
        if limit is None:
            await self.app(scope, receive, send)
            return

        content_lengths = [
            value
            for key, value in scope.get("headers", [])
            if key.lower() == b"content-length"
        ]
        if len(content_lengths) > 1:
            await self._respond(send, 400, "invalid_content_length")
            return
        if content_lengths:
            raw_length = content_lengths[0]
            if not raw_length.isdigit():
                await self._respond(send, 400, "invalid_content_length")
                return
            if int(raw_length) > limit:
                await self._respond(send, 413, "request_body_too_large")
                return

        received = 0
        overflowed = False

        async def limited_receive():
            nonlocal received, overflowed
            if overflowed:
                return {"type": "http.request", "body": b"", "more_body": False}
            message = await receive()
            if message.get("type") == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    overflowed = True
                    # Do not forward the crossing chunk or ask the server for
                    # more data. The app may convert the truncated body into a
                    # validation response; suppress that response below and
                    # return the stable 413 response after it unwinds.
                    return {"type": "http.request", "body": b"", "more_body": False}
            return message

        async def tracked_send(message):
            if overflowed:
                return
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except Exception:
            if not overflowed:
                raise
        if overflowed:
            await self._respond(send, 413, "request_body_too_large")
