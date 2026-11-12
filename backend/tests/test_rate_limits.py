from __future__ import annotations

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request
import httpx

from app.auth.dependencies import get_current_clerk_user
from app.main import app
from app.security.rate_limits import (
    RateLimitExceeded,
    RateLimiter,
    RatePolicy,
    Window,
    client_ip,
    configured_policies,
    enforce_limit,
)


class FakeRedis:
    def __init__(self):
        self.counts: dict[str, int] = {}
        self.ttls: dict[str, int] = {}
        self.fail = False

    async def eval(self, _script, key_count, *args):
        if self.fail:
            raise ConnectionError("store offline")
        keys = args[:key_count]
        limits_and_ttls = args[key_count:]
        retry = 0
        for i, key in enumerate(keys):
            count = self.counts.get(key, 0) + 1
            self.counts[key] = count
            self.ttls.setdefault(key, limits_and_ttls[i * 2 + 1])
            if count > limits_and_ttls[i * 2]:
                retry = max(retry, self.ttls[key])
        return retry

    async def aclose(self):
        return None


def make_request(headers=None, client="10.0.0.4"):
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/events",
        "raw_path": b"/events",
        "query_string": b"",
        "headers": [(key.lower().encode(), value.encode()) for key, value in (headers or {}).items()],
        "client": (client, 1234),
        "server": ("test", 80),
        "app": SimpleNamespace(state=SimpleNamespace()),
    }
    return Request(scope)


class RateLimiterTests(unittest.IsolatedAsyncioTestCase):
    async def test_limits_are_isolated_by_identity(self):
        redis = FakeRedis()
        limiter = RateLimiter(redis, {"tiny": RatePolicy("tiny", (Window(1, 30),))})
        await limiter.check("tiny", "user:one")
        await limiter.check("tiny", "user:two")
        with self.assertRaises(RateLimitExceeded):
            await limiter.check("tiny", "user:one")

    async def test_retry_after_and_429_are_returned(self):
        request = make_request()
        redis = FakeRedis()
        request.app.state.rate_limiter = RateLimiter(
            redis, {"tiny": RatePolicy("tiny", (Window(1, 30),))}
        )
        await enforce_limit(request, "tiny", "user:one")
        with self.assertRaises(HTTPException) as caught:
            await enforce_limit(request, "tiny", "user:one")
        self.assertEqual(caught.exception.status_code, 429)
        self.assertEqual(caught.exception.headers["Retry-After"], "30")

    async def test_unconfigured_shared_store_fails_closed_for_user_policy(self):
        request = make_request()
        request.app.state.rate_limiter = RateLimiter(
            None,
            {"write": RatePolicy("write", (Window(1, 60),), True)},
            require_shared_store=True,
        )
        with self.assertRaises(HTTPException) as caught:
            await enforce_limit(request, "write", "user:one")
        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(caught.exception.detail["reason"], "rate_limit_store_unavailable")

    async def test_configured_store_outage_fails_closed_for_protected_policy(self):
        request = make_request()
        redis = FakeRedis()
        redis.fail = True
        request.app.state.rate_limiter = RateLimiter(
            redis,
            {"upload": RatePolicy("upload", (Window(10, 60),), True)},
            require_shared_store=True,
        )
        with self.assertRaises(HTTPException) as caught:
            await enforce_limit(request, "upload", "user:one")
        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(caught.exception.detail["reason"], "rate_limit_store_unavailable")

    async def test_public_store_failure_uses_per_process_fallback(self):
        request = make_request()
        redis = FakeRedis()
        redis.fail = True
        request.app.state.rate_limiter = RateLimiter(
            redis, {"public": RatePolicy("public", (Window(1, 60),))}
        )
        await enforce_limit(request, "public", "ip:127.0.0.1")
        with self.assertRaises(HTTPException) as caught:
            await enforce_limit(request, "public", "ip:127.0.0.1")
        self.assertEqual(caught.exception.status_code, 429)

    async def test_anonymous_identity_ignores_caller_forwarded_for(self):
        request = make_request({"X-Forwarded-For": "198.51.100.99"}, client="10.0.0.4")
        self.assertEqual(client_ip(request), "10.0.0.4")

    async def test_render_edge_client_ip_is_used_and_validated(self):
        request = make_request(
            {"CF-Connecting-IP": "198.51.100.22", "X-Forwarded-For": "203.0.113.99"},
            client="10.0.0.4",
        )
        self.assertEqual(client_ip(request), "198.51.100.22")
        invalid = make_request({"CF-Connecting-IP": "not-an-ip"}, client="10.0.0.4")
        self.assertEqual(client_ip(invalid), "10.0.0.4")

    async def test_local_window_expiry_allows_a_later_request(self):
        limiter = RateLimiter(None, {"tiny": RatePolicy("tiny", (Window(1, 1),))})
        await limiter.check("tiny", "user:one")
        with self.assertRaises(RateLimitExceeded):
            await limiter.check("tiny", "user:one")
        await asyncio.sleep(1.05)
        await limiter.check("tiny", "user:one")

    async def test_limit_thresholds_can_be_tuned_by_environment(self):
        with patch.dict(
            "os.environ",
            {"RATE_LIMIT_PUBLIC_READ_PER_MINUTE": "250"},
            clear=False,
        ):
            policies = configured_policies()
        self.assertEqual(policies["public_read"].windows[0].requests, 250)
        self.assertEqual(policies["public_read"].windows[1].requests, 1200)

    async def test_sync_route_still_rejects_unauthenticated_requests(self):
        async def reject_auth():
            raise HTTPException(status_code=401, detail={"reason": "not_authenticated"})

        app.dependency_overrides.clear()
        app.dependency_overrides[get_current_clerk_user] = reject_auth
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post("/users/sync")
            self.assertEqual(response.status_code, 401)
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    unittest.main()


if __name__ == "__main__":
    unittest.main()
