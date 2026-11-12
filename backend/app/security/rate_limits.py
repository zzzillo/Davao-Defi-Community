"""Shared Redis-backed request limits with bounded local fallback state."""

from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import logging
import math
import os
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Window:
    requests: int
    seconds: int


@dataclass(frozen=True)
class RatePolicy:
    name: str
    windows: tuple[Window, ...]
    shared_store_required: bool = False


# No API request logs were available when these initial values were selected.
# Keep public GET ceilings high because users can share NAT addresses; tune from
# observed production traffic before making them more restrictive.
DEFAULT_POLICIES: dict[str, RatePolicy] = {
    "public_read": RatePolicy("public_read", (Window(120, 60), Window(1200, 600))),
    "user_sync": RatePolicy("user_sync", (Window(5, 60), Window(30, 3600)), True),
    "upload": RatePolicy("upload", (Window(10, 60), Window(60, 3600)), True),
    "write": RatePolicy("write", (Window(30, 60), Window(300, 3600)), True),
    "admin": RatePolicy("admin", (Window(120, 60), Window(1200, 3600)), True),
    "webhook": RatePolicy("webhook", (Window(120, 60), Window(2400, 3600))),
    "realtime": RatePolicy("realtime", (Window(3, 60), Window(10, 600)), True),
}


def configured_policies() -> dict[str, RatePolicy]:
    """Read tunable ceilings from environment without logging their values."""
    variable_names = {
        "public_read": ("RATE_LIMIT_PUBLIC_READ_PER_MINUTE", "RATE_LIMIT_PUBLIC_READ_PER_10_MINUTES"),
        "user_sync": ("RATE_LIMIT_USER_SYNC_PER_MINUTE", "RATE_LIMIT_USER_SYNC_PER_HOUR"),
        "upload": ("RATE_LIMIT_UPLOAD_PER_MINUTE", "RATE_LIMIT_UPLOAD_PER_HOUR"),
        "write": ("RATE_LIMIT_WRITE_PER_MINUTE", "RATE_LIMIT_WRITE_PER_HOUR"),
        "admin": ("RATE_LIMIT_ADMIN_PER_MINUTE", "RATE_LIMIT_ADMIN_PER_HOUR"),
        "webhook": ("RATE_LIMIT_WEBHOOK_PER_MINUTE", "RATE_LIMIT_WEBHOOK_PER_HOUR"),
        "realtime": ("RATE_LIMIT_REALTIME_PER_MINUTE", "RATE_LIMIT_REALTIME_PER_10_MINUTES"),
    }
    configured: dict[str, RatePolicy] = {}
    for name, policy in DEFAULT_POLICIES.items():
        names = variable_names[name]
        windows = []
        for index, window in enumerate(policy.windows):
            raw = os.getenv(names[index])
            if raw is None:
                windows.append(window)
                continue
            try:
                requests = int(raw)
            except ValueError as exc:
                raise ValueError(f"{names[index]} must be a positive integer") from exc
            if requests < 1:
                raise ValueError(f"{names[index]} must be a positive integer")
            windows.append(Window(requests, window.seconds))
        configured[name] = RatePolicy(policy.name, tuple(windows), policy.shared_store_required)
    return configured

_CHECK_AND_INCREMENT = """
local retry_after = 0
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], ARGV[(i * 2)]) end
  if count > tonumber(ARGV[(i * 2) - 1]) then
    local ttl = redis.call('TTL', KEYS[i])
    if ttl > retry_after then retry_after = ttl end
  end
end
return retry_after
"""


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = max(1, retry_after)


class RateLimiter:
    """Atomic multi-window counters, falling back to local counters if needed."""

    def __init__(
        self,
        redis: Redis | None,
        policies: dict[str, RatePolicy] | None = None,
        *,
        require_shared_store: bool = False,
    ):
        self.redis = redis
        self.policies = policies or configured_policies()
        self.require_shared_store = require_shared_store
        self._local: OrderedDict[tuple[str, int], tuple[int, float]] = OrderedDict()
        self._lock = asyncio.Lock()
        self._store_unavailable_logged = False

    @classmethod
    def from_url(cls, url: str | None, *, require_shared_store: bool = False) -> "RateLimiter":
        client = Redis.from_url(url, encoding="utf-8", decode_responses=True) if url else None
        return cls(client, require_shared_store=require_shared_store)

    async def close(self) -> None:
        if self.redis is not None:
            await self.redis.aclose()

    async def check(self, policy_name: str, identity: str) -> None:
        policy = self.policies[policy_name]
        identity_digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        if self.redis is None:
            if policy.shared_store_required and self.require_shared_store:
                raise ConnectionError("shared rate limit store is not configured")
            retry = await self._check_local(policy, identity_digest)
        else:
            keys = [f"ddc:rl:{policy.name}:{identity_digest}:{w.seconds}" for w in policy.windows]
            args: list[int] = []
            for window in policy.windows:
                args.extend((window.requests, window.seconds))
            retry = int(await self.redis.eval(_CHECK_AND_INCREMENT, len(keys), *keys, *args))
        if retry:
            raise RateLimitExceeded(retry)

    async def _check_local(self, policy: RatePolicy, identity_digest: str) -> int:
        now = time.monotonic()
        retry_after = 0
        async with self._lock:
            for index, window in enumerate(policy.windows):
                key = (f"{policy.name}:{identity_digest}", index)
                count, reset_at = self._local.get(key, (0, now + window.seconds))
                if reset_at <= now:
                    count, reset_at = 0, now + window.seconds
                count += 1
                self._local[key] = (count, reset_at)
                self._local.move_to_end(key)
                if count > window.requests:
                    retry_after = max(retry_after, math.ceil(reset_at - now))
            # Keep fallback state bounded if the service receives many unique IPs.
            while len(self._local) > 10000:
                self._local.popitem(last=False)
        return retry_after


def client_ip(request: Request) -> str:
    """Use the IP header overwritten by Render's Cloudflare edge; ignore XFF."""
    forwarded = request.headers.get("cf-connecting-ip")
    if forwarded:
        try:
            return str(ipaddress.ip_address(forwarded.strip()))
        except ValueError:
            logger.warning("Ignoring invalid Cloudflare client IP metadata")
    peer = request.client.host if request.client else "unknown"
    try:
        return str(ipaddress.ip_address(peer))
    except ValueError:
        return "unknown"


def _limiter(request: Request) -> RateLimiter:
    limiter = getattr(request.app.state, "rate_limiter", None)
    if limiter is None:
        # Useful for ASGI test apps that are not run through the app lifespan.
        limiter = RateLimiter(redis=None)
        request.app.state.rate_limiter = limiter
    return limiter


async def enforce_limit(request: Request, policy_name: str, identity: str) -> None:
    limiter = _limiter(request)
    try:
        await limiter.check(policy_name, identity)
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"reason": "rate_limit_exceeded"},
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc
    except (RedisError, ConnectionError, TimeoutError):
        policy = limiter.policies[policy_name]
        if not limiter._store_unavailable_logged:
            logger.error("Shared rate limit store unavailable; using the configured fallback policy")
            limiter._store_unavailable_logged = True
        if policy.shared_store_required:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"reason": "rate_limit_store_unavailable"},
            )
        # Public reads use a per-process fallback so a store outage does not
        # make public content unavailable.
        try:
            retry = await limiter._check_local(policy, hashlib.sha256(identity.encode()).hexdigest())
        except Exception as exc:
            raise HTTPException(status_code=503, detail={"reason": "rate_limit_store_unavailable"}) from exc
        if retry:
            raise HTTPException(
                status_code=429,
                detail={"reason": "rate_limit_exceeded"},
                headers={"Retry-After": str(retry)},
            )


async def limit_public_read(request: Request) -> None:
    await enforce_limit(request, "public_read", f"ip:{client_ip(request)}")


async def limit_webhook(request: Request) -> None:
    await enforce_limit(request, "webhook", f"ip:{client_ip(request)}")


def user_limit(policy_name: str):
    """Build a dependency keyed by an already verified local user row."""
    from fastapi import Depends

    from app.auth.dependencies import get_current_db_user
    from app.models.user import User

    async def dependency(request: Request, user: User = Depends(get_current_db_user)) -> None:
        await enforce_limit(request, policy_name, f"user:{user.id}")

    dependency.__name__ = f"limit_{policy_name}"
    return dependency


def clerk_sync_limit():
    """Use the verified Clerk subject because /users/sync precedes local sync."""
    from fastapi import Depends

    from app.auth.dependencies import get_current_clerk_user

    async def dependency(request: Request, clerk_state=Depends(get_current_clerk_user)) -> None:
        subject = clerk_state.payload.get("sub")
        if not subject:
            raise HTTPException(status_code=401, detail={"reason": "not_authenticated"})
        await enforce_limit(request, "user_sync", f"clerk:{subject}")

    dependency.__name__ = "limit_user_sync"
    return dependency


def realtime_limit():
    """Apply the connection-attempt ceiling with short-lived auth DB scope."""
    from fastapi import Depends

    from app.auth.dependencies import get_stream_current_user
    from app.auth.dependencies import CurrentUser

    async def dependency(
        request: Request,
        user: CurrentUser = Depends(get_stream_current_user, scope="function"),
    ) -> None:
        await enforce_limit(request, "realtime", f"user:{user.user_id}")

    dependency.__name__ = "limit_realtime"
    return dependency


limit_sync = clerk_sync_limit()
limit_upload = user_limit("upload")
limit_write = user_limit("write")
limit_admin = user_limit("admin")
limit_realtime = realtime_limit()
