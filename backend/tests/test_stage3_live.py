"""Guarded Stage 3 integration tests against the isolated *_test database.

Run only after scripts/upgrade_test_db.py validates and migrates backend/.env.test:

    RUN_STAGE3_LIVE_TESTS=true .venv/bin/python -m unittest tests.test_stage3_live -v

Clerk calls are replaced with an in-memory provider double; no real invitation
email or Clerk account is created.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

from dotenv import dotenv_values, load_dotenv
from sqlalchemy import delete, func, or_, select

from app.auth.permissions import Role
from app.config import validate_test_database_url
from app.models.activity_log import ActivityLog
from app.models.clerk_webhook_event import ClerkWebhookEvent
from app.models.user import AccountStatus, User
from app.models.user_invitation import InvitationStatus, UserInvitation

BACKEND_DIR = Path(__file__).resolve().parents[1]


class FakeInvitations:
    def __init__(self):
        self.items: dict[str, SimpleNamespace] = {}
        self.create_calls = 0
        self.fail_create_once = False
        self.store_then_fail_once = False
        self.fail_list_count = 0
        self.fail_revoke_once = False

    async def create_async(self, *, request, retries=None, **kwargs):
        self.create_calls += 1
        if self.fail_create_once:
            self.fail_create_once = False
            raise RuntimeError("simulated provider create failure")
        if any(
            item.email_address == request["email_address"]
            and item.status == InvitationStatus.PENDING.value
            for item in self.items.values()
        ):
            raise RuntimeError("provider already has an active invitation")
        now_ms = int(time.time() * 1000)
        item = SimpleNamespace(
            id=f"inv_stage3_{self.create_calls}",
            email_address=request["email_address"],
            status=InvitationStatus.PENDING.value,
            public_metadata=request.get("public_metadata") or {},
            created_at=now_ms,
            expires_at=now_ms + 30 * 24 * 60 * 60 * 1000,
        )
        self.items[item.id] = item
        if self.store_then_fail_once:
            self.store_then_fail_once = False
            raise RuntimeError("simulated lost provider response")
        return item

    async def list_async(self, *, status=None, query=None, limit=10, offset=0, **kwargs):
        if self.fail_list_count:
            self.fail_list_count -= 1
            raise RuntimeError("simulated provider list failure")
        values = list(self.items.values())
        if query:
            values = [item for item in values if item.id == query or item.email_address == query]
        if status is not None:
            values = [item for item in values if item.status == status]
        else:
            values = [item for item in values if item.status != InvitationStatus.REVOKED.value]
        return values[offset : offset + limit]

    async def revoke_async(self, *, invitation_id, retries=None, **kwargs):
        if self.fail_revoke_once:
            self.fail_revoke_once = False
            raise RuntimeError("simulated provider revoke failure")
        item = self.items[invitation_id]
        item.status = InvitationStatus.REVOKED.value
        return item


class FakeClerk:
    def __init__(self):
        self.invitations = FakeInvitations()
        self.user_records: dict[str, dict] = {}
        self.user_fetches = 0
        self.users = SimpleNamespace(get_async=self.get_user)

    async def get_user(self, *, user_id, **kwargs):
        self.user_fetches += 1
        return self.user_records[user_id]


@unittest.skipUnless(
    os.getenv("RUN_STAGE3_LIVE_TESTS") == "true",
    "set RUN_STAGE3_LIVE_TESTS=true to opt in to isolated Neon integration tests",
)
class Stage3LiveTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # Load the app URL first and compare before redirecting any app engine.
        load_dotenv(BACKEND_DIR / ".env", override=False)
        cls.original_env = {
            name: os.environ.get(name)
            for name in ("DATABASE_URL", "ALLOW_REMOTE_TEST_DATABASE")
        }
        test_settings = dotenv_values(BACKEND_DIR / ".env.test")
        test_url = test_settings.get("TEST_DATABASE_URL")
        if not test_url:
            raise RuntimeError("backend/.env.test must set TEST_DATABASE_URL")
        os.environ["ALLOW_REMOTE_TEST_DATABASE"] = str(
            test_settings.get("ALLOW_REMOTE_TEST_DATABASE", "false")
        )
        validate_test_database_url(str(test_url))
        os.environ["DATABASE_URL"] = str(test_url)

        from app.config import get_settings
        from app.database import _get_session_factory, get_engine

        get_settings.cache_clear()
        get_engine.cache_clear()
        _get_session_factory.cache_clear()
        from app.main import app

        cls.app = app
        cls.app.dependency_overrides.clear()
        cls.engine = get_engine()
        cls.session_factory = _get_session_factory()

    @classmethod
    def tearDownClass(cls) -> None:
        async def dispose() -> None:
            await cls.engine.dispose()

        asyncio.run(dispose())
        cls.app.dependency_overrides.clear()
        from app.config import get_settings
        from app.database import _get_session_factory, get_engine

        for name, value in cls.original_env.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
        get_settings.cache_clear()
        get_engine.cache_clear()
        _get_session_factory.cache_clear()

    async def asyncSetUp(self) -> None:
        import httpx
        from app.auth.dependencies import get_current_clerk_user

        await self.engine.dispose()
        self.prefix = f"stage3-{uuid4().hex[:10]}"
        self.current_clerk_id = f"{self.prefix}-admin"
        self.fake_clerk = FakeClerk()
        async def current_clerk_user():
            return SimpleNamespace(payload={"sub": self.current_clerk_id}, is_authenticated=True)

        self.app.dependency_overrides.clear()
        self.app.dependency_overrides[get_current_clerk_user] = current_clerk_user
        self.clerk_patch = patch(
            "app.services.clerk_service.get_clerk",
            return_value=self.fake_clerk,
        )
        self.clerk_patch.start()
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app),
            base_url="http://testserver",
        )

        async with self.session_factory() as db:
            for suffix, role in (("admin", Role.ADMIN), ("member", Role.MEMBER)):
                db.add(
                    User(
                        clerk_user_id=f"{self.prefix}-{suffix}",
                        email=f"{self.prefix}-{suffix}@example.test",
                        display_name=f"{self.prefix} {suffix}",
                        role=role.value,
                        status=AccountStatus.ACTIVE.value,
                        permissions=[],
                    )
                )
            await db.commit()

    async def asyncTearDown(self) -> None:
        await self.client.aclose()
        self.clerk_patch.stop()
        ids = [f"{self.prefix}-admin", f"{self.prefix}-member"]
        async with self.session_factory() as db:
            user_ids = list(
                (
                    await db.scalars(
                        select(User.id).where(User.clerk_user_id.like(f"{self.prefix}%"))
                    )
                ).all()
            )
            if user_ids:
                await db.execute(
                    delete(ActivityLog).where(
                        or_(ActivityLog.user_id.in_(user_ids), ActivityLog.owner_id.in_(user_ids))
                    )
                )
            await db.execute(
                delete(UserInvitation).where(
                    or_(
                        UserInvitation.invited_by_user_id.in_(user_ids or [uuid4()]),
                        UserInvitation.email.like(f"{self.prefix}%"),
                    )
                )
            )
            await db.execute(
                delete(ClerkWebhookEvent).where(ClerkWebhookEvent.event_id.like(f"{self.prefix}%"))
            )
            await db.execute(delete(User).where(User.clerk_user_id.like(f"{self.prefix}%")))
            await db.commit()
        self.app.dependency_overrides.clear()

    def _user_payload(self, clerk_user_id: str, email: str) -> dict:
        email_id = f"email_{clerk_user_id}"
        return {
            "id": clerk_user_id,
            "primary_email_address_id": email_id,
            "email_addresses": [
                {
                    "id": email_id,
                    "email_address": email,
                    "verification": {"status": "verified", "strategy": "ticket"},
                }
            ],
            "first_name": "New",
            "last_name": "Contributor",
            "updated_at": int(time.time() * 1000),
            "public_metadata": {"role": "superadmin"},
        }

    async def test_invite_delivery_idempotent_acceptance_retry_and_revocation(self) -> None:
        self.current_clerk_id = f"{self.prefix}-admin"
        accepted_email = f"{self.prefix}-accepted@example.test"
        invite_body = {
            "email": accepted_email,
            "role": "official",
            "profile_details": {"display_name": "Invited Official", "positions": ["Treasurer"]},
        }
        headers = {"Idempotency-Key": f"{self.prefix}-accepted-key"}

        rejected = await self.client.post(
            "/admin/invitations",
            json={"email": f"{self.prefix}-blocked@example.test", "role": "admin"},
        )
        self.assertEqual(rejected.status_code, 403, rejected.text)

        first = await self.client.post("/admin/invitations", json=invite_body, headers=headers)
        self.assertEqual(first.status_code, 201, first.text)
        second = await self.client.post("/admin/invitations", json=invite_body, headers=headers)
        self.assertEqual(second.status_code, 201, second.text)
        self.assertEqual(first.json()["id"], second.json()["id"])
        self.assertEqual(self.fake_clerk.invitations.create_calls, 1)

        async with self.session_factory() as db:
            accepted_local_invite = await db.scalar(
                select(UserInvitation).where(UserInvitation.id == UUID(first.json()["id"]))
            )
            provider_invitation_id = accepted_local_invite.clerk_invitation_id
        accepted_provider_invite = self.fake_clerk.invitations.items[provider_invitation_id]
        accepted_provider_invite.status = InvitationStatus.ACCEPTED.value
        async with self.session_factory() as db:
            accepted_local_invite.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            await db.commit()
        shadow_invite = await self.client.post(
            "/admin/invitations",
            json={"email": accepted_email, "role": "member"},
            headers={"Idempotency-Key": f"{self.prefix}-accepted-second-key"},
        )
        self.assertEqual(shadow_invite.status_code, 409, shadow_invite.text)

        uninvited_user_id = f"{self.prefix}-uninvited-user"
        self.fake_clerk.user_records[uninvited_user_id] = self._user_payload(
            uninvited_user_id, f"{self.prefix}-uninvited@example.test"
        )
        self.current_clerk_id = uninvited_user_id
        uninvited_sync = await self.client.post("/users/sync")
        self.assertEqual(uninvited_sync.status_code, 403, uninvited_sync.text)

        accepted_user_id = f"{self.prefix}-accepted-user"
        self.fake_clerk.user_records[accepted_user_id] = self._user_payload(accepted_user_id, accepted_email)
        self.current_clerk_id = accepted_user_id
        synced = await self.client.post("/users/sync")
        self.assertEqual(synced.status_code, 200, synced.text)
        self.assertEqual(synced.json()["role"], Role.OFFICIAL.value)
        self.assertEqual(synced.json()["display_name"], "Invited Official")

        concurrent_email = f"{self.prefix}-concurrent@example.test"
        self.current_clerk_id = f"{self.prefix}-admin"
        concurrent_body = {"email": concurrent_email, "role": "member"}
        concurrent_headers = {"Idempotency-Key": f"{self.prefix}-concurrent-key"}
        provider_calls_before = self.fake_clerk.invitations.create_calls
        concurrent_responses = await asyncio.gather(
            self.client.post("/admin/invitations", json=concurrent_body, headers=concurrent_headers),
            self.client.post("/admin/invitations", json=concurrent_body, headers=concurrent_headers),
        )
        self.assertTrue(
            all(response.status_code in {201, 502} for response in concurrent_responses),
            [(response.status_code, response.text) for response in concurrent_responses],
        )
        self.assertEqual(self.fake_clerk.invitations.create_calls - provider_calls_before, 1)
        async with self.session_factory() as db:
            self.assertEqual(
                await db.scalar(
                    select(func.count()).select_from(UserInvitation).where(UserInvitation.email == concurrent_email)
                ),
                1,
            )

        retry_email = f"{self.prefix}-retry@example.test"
        self.fake_clerk.invitations.fail_create_once = True
        self.current_clerk_id = f"{self.prefix}-admin"
        failed = await self.client.post(
            "/admin/invitations",
            json={"email": retry_email, "role": "member"},
            headers={"Idempotency-Key": f"{self.prefix}-retry-key"},
        )
        self.assertEqual(failed.status_code, 502, failed.text)
        failed_id = failed.json()["detail"]["invitation_id"]
        retried = await self.client.post(f"/admin/invitations/{failed_id}/retry")
        self.assertEqual(retried.status_code, 200, retried.text)
        self.assertEqual(retried.json()["status"], InvitationStatus.PENDING.value)

        self.fake_clerk.invitations.fail_revoke_once = True
        uncertain_revoke = await self.client.post(f"/admin/invitations/{failed_id}/revoke")
        self.assertEqual(uncertain_revoke.status_code, 502, uncertain_revoke.text)
        self.assertEqual(uncertain_revoke.json()["detail"]["status"], InvitationStatus.REVOKED.value)
        revoked = await self.client.post(f"/admin/invitations/{failed_id}/revoke")
        self.assertEqual(revoked.status_code, 200, revoked.text)
        self.assertEqual(revoked.json()["status"], InvitationStatus.REVOKED.value)

        revoked_user_id = f"{self.prefix}-revoked-user"
        self.fake_clerk.user_records[revoked_user_id] = self._user_payload(revoked_user_id, retry_email)
        self.current_clerk_id = revoked_user_id
        blocked_sync = await self.client.post("/users/sync")
        self.assertEqual(blocked_sync.status_code, 403, blocked_sync.text)
        async with self.session_factory() as db:
            self.assertIsNone(
                await db.scalar(select(User.id).where(User.clerk_user_id == revoked_user_id))
            )

    async def test_lost_create_response_can_reconcile_late_acceptance_after_expiry(self) -> None:
        from datetime import datetime, timedelta, timezone

        self.current_clerk_id = f"{self.prefix}-admin"
        email = f"{self.prefix}-lost-response@example.test"
        self.fake_clerk.invitations.store_then_fail_once = True
        self.fake_clerk.invitations.fail_list_count = 1
        created = await self.client.post(
            "/admin/invitations",
            json={"email": email, "role": "member"},
            headers={"Idempotency-Key": f"{self.prefix}-lost-response-key"},
        )
        self.assertEqual(created.status_code, 502, created.text)
        local_id = UUID(created.json()["detail"]["invitation_id"])
        async with self.session_factory() as db:
            invitation = await db.scalar(select(UserInvitation).where(UserInvitation.id == local_id))
            self.assertIsNone(invitation.clerk_invitation_id)
            invitation.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            await db.commit()

        provider_invitation = next(iter(self.fake_clerk.invitations.items.values()))
        provider_invitation.status = InvitationStatus.ACCEPTED.value
        shadow = await self.client.post(
            "/admin/invitations",
            json={"email": email, "role": "member"},
            headers={"Idempotency-Key": f"{self.prefix}-lost-response-shadow"},
        )
        self.assertEqual(shadow.status_code, 409, shadow.text)

        user_id = f"{self.prefix}-late-accepted"
        self.fake_clerk.user_records[user_id] = self._user_payload(user_id, email)
        self.current_clerk_id = user_id
        synced = await self.client.post("/users/sync")
        self.assertEqual(synced.status_code, 200, synced.text)
        self.assertEqual(synced.json()["role"], Role.MEMBER.value)
        self.assertEqual(self.fake_clerk.invitations.create_calls, 1)
        async with self.session_factory() as db:
            invitation = await db.scalar(select(UserInvitation).where(UserInvitation.id == local_id))
            self.assertEqual(invitation.status, InvitationStatus.ACCEPTED.value)
            self.assertIsNotNone(invitation.clerk_invitation_id)

    async def test_signed_webhook_duplicate_deleted_tombstone_and_stale_update(self) -> None:
        secret_bytes = b"stage3-test-signing-key"
        secret = "whsec_" + base64.b64encode(secret_bytes).decode("ascii")
        user_id = f"{self.prefix}-deleted"

        def signed_request_parts(event_id: str, event: dict, *, invalid=False):
            body = json.dumps(event, separators=(",", ":")).encode()
            timestamp = str(int(time.time()))
            signed = event_id.encode() + b"." + timestamp.encode() + b"." + body
            digest = base64.b64encode(hmac.new(secret_bytes, signed, hashlib.sha256).digest()).decode()
            invalid_digest = base64.b64encode(b"definitely-not-a-valid-signature").decode()
            signature = "v1," + (invalid_digest if invalid else digest)
            return body, {
                "svix-id": event_id,
                "svix-timestamp": timestamp,
                "svix-signature": signature,
                "content-type": "application/json",
            }

        now_ms = int(time.time() * 1000)
        deleted_event = {
            "type": "user.deleted",
            "timestamp": now_ms,
            "data": {"id": user_id, "deleted": True},
        }
        delete_id = f"{self.prefix}-event-delete"
        body, headers = signed_request_parts(delete_id, deleted_event)
        with patch(
            "app.routers.webhooks.get_settings",
            return_value=SimpleNamespace(clerk_webhook_signing_secret=secret),
        ):
            deleted = await self.client.post("/webhooks/clerk", content=body, headers=headers)
            self.assertEqual(deleted.status_code, 200, deleted.text)
            self.assertEqual(deleted.json()["status"], "deleted")

            duplicate_body, duplicate_headers = signed_request_parts(delete_id, deleted_event)
            duplicate = await self.client.post(
                "/webhooks/clerk", content=duplicate_body, headers=duplicate_headers
            )
            self.assertEqual(duplicate.status_code, 200, duplicate.text)
            self.assertTrue(duplicate.json()["duplicate"])

            stale_update = {
                "type": "user.updated",
                "timestamp": now_ms + 1,
                "data": {"id": user_id},
            }
            stale_body, stale_headers = signed_request_parts(
                f"{self.prefix}-event-stale-update", stale_update
            )
            stale = await self.client.post(
                "/webhooks/clerk", content=stale_body, headers=stale_headers
            )
            self.assertEqual(stale.status_code, 200, stale.text)
            self.assertEqual(stale.json()["ignored"], "clerk_identity_deleted")

            invalid_body, invalid_headers = signed_request_parts(
                f"{self.prefix}-event-invalid",
                {"type": "user.deleted", "timestamp": now_ms, "data": {"id": user_id}},
                invalid=True,
            )
            invalid = await self.client.post(
                "/webhooks/clerk", content=invalid_body, headers=invalid_headers
            )
            self.assertEqual(invalid.status_code, 400)

            malformed_body, malformed_headers = signed_request_parts(
                f"{self.prefix}-event-malformed",
                {"type": "user.deleted", "timestamp": now_ms, "data": {"id": user_id}},
            )
            malformed_headers["svix-signature"] = "v1,invalid"
            malformed = await self.client.post(
                "/webhooks/clerk", content=malformed_body, headers=malformed_headers
            )
            self.assertEqual(malformed.status_code, 400)

        self.assertEqual(self.fake_clerk.user_fetches, 0)
        async with self.session_factory() as db:
            tombstone = await db.scalar(select(User).where(User.clerk_user_id == user_id))
            self.assertIsNotNone(tombstone)
            self.assertEqual(tombstone.status, AccountStatus.SUSPENDED.value)
            self.assertIsNotNone(tombstone.clerk_deleted_at)
            self.assertEqual(
                await db.scalar(select(func.count()).select_from(ClerkWebhookEvent).where(ClerkWebhookEvent.event_id == delete_id)),
                1,
            )

    async def test_bootstrap_first_superadmin_is_atomic_and_one_time(self) -> None:
        from scripts import bootstrap_superadmin

        clerk_user_id = f"{self.prefix}-bootstrap"
        email = f"{self.prefix}-bootstrap@example.test"
        provider_user = self._user_payload(clerk_user_id, email)
        with patch(
            "scripts.bootstrap_superadmin.clerk_service.find_verified_clerk_user_by_primary_email",
            new=AsyncMock(return_value=provider_user),
        ):
            user_id = await bootstrap_superadmin.bootstrap_first_superadmin(email)
            with self.assertRaises(bootstrap_superadmin.BootstrapRefused):
                await bootstrap_superadmin.bootstrap_first_superadmin(email)

        async with self.session_factory() as db:
            user = await db.scalar(select(User).where(User.id == user_id))
            self.assertEqual(user.role, Role.SUPERADMIN.value)
            self.assertEqual(user.status, AccountStatus.ACTIVE.value)
            logs = await db.scalar(
                select(func.count())
                .select_from(ActivityLog)
                .where(ActivityLog.owner_id == user_id, ActivityLog.resource_id == user_id)
            )
            self.assertEqual(logs, 1)


if __name__ == "__main__":
    unittest.main()
