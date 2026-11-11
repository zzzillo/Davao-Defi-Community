"""Offline Stage 3 Clerk onboarding and lifecycle contract tests."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException


class Stage3ClerkOfflineTests(unittest.IsolatedAsyncioTestCase):
    def test_primary_email_uses_clerk_primary_id_and_verified_status(self) -> None:
        from app.services.user_service import verified_primary_email

        payload = {
            "primary_email_address_id": "email_primary",
            "email_addresses": [
                {
                    "id": "email_other",
                    "email_address": "wrong@example.test",
                    "verification": {"status": "verified"},
                },
                {
                    "id": "email_primary",
                    "email_address": " RIGHT@Example.Test ",
                    "verification": {"status": "verified"},
                },
            ],
        }
        self.assertEqual(verified_primary_email(payload), "right@example.test")
        payload["email_addresses"][1]["verification"]["status"] = "unverified"
        self.assertIsNone(verified_primary_email(payload))
        payload["primary_email_address_id"] = "missing"
        self.assertIsNone(verified_primary_email(payload))

    def test_clerk_issuer_requires_https_origin(self) -> None:
        from app.config import validate_clerk_issuer_url

        self.assertEqual(validate_clerk_issuer_url("https://instance.clerk.accounts.dev/"), "https://instance.clerk.accounts.dev")
        for invalid in (None, "http://instance.example", "https://instance.example/path", "https://user:pw@instance.example"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                validate_clerk_issuer_url(invalid)

    def test_invitation_schema_accepts_only_supported_profile_details(self) -> None:
        from pydantic import ValidationError
        from app.auth.permissions import Role
        from app.schemas.user import InvitationCreate

        payload = InvitationCreate.model_validate(
            {
                "email": "  Member@Example.Test ",
                "role": "official",
                "profile_details": {
                    "display_name": "New Member",
                    "positions": ["President"],
                    "contributions": ["Led recruitment"],
                },
            }
        )
        self.assertEqual(payload.email, "member@example.test")
        self.assertIs(payload.role, Role.OFFICIAL)
        with self.assertRaises(ValidationError):
            InvitationCreate.model_validate({"email": "a@example.test", "profile_details": {"role": "superadmin"}})
        with self.assertRaises(ValidationError):
            InvitationCreate.model_validate({"email": "a@example.test", "profile_details": {"public_slug": "forbidden"}})

    async def test_invitation_acceptance_requires_exact_provider_marker_email_and_state(self) -> None:
        from app.models.user_invitation import InvitationStatus
        from app.services.invitation_service import InvitationNotAccepted, accepted_provider_invitation

        invitation_id = uuid4()
        local = SimpleNamespace(
            id=invitation_id,
            email="member@example.test",
            clerk_invitation_id="inv_stage3",
        )
        accepted = SimpleNamespace(
            id="inv_stage3",
            email_address="member@example.test",
            status=InvitationStatus.ACCEPTED.value,
            public_metadata={"ddc_invitation_id": str(invitation_id)},
        )

        async def run_checks():
            with patch(
                "app.services.invitation_service.provider_invitation_for_local",
                new=AsyncMock(return_value=accepted),
            ):
                self.assertIs(await accepted_provider_invitation(local), accepted)
            for change in (
                {"email_address": "different@example.test"},
                {"status": InvitationStatus.REVOKED.value},
                {"public_metadata": {"ddc_invitation_id": str(uuid4())}},
            ):
                candidate = SimpleNamespace(**{**accepted.__dict__, **change})
                with patch(
                    "app.services.invitation_service.provider_invitation_for_local",
                    new=AsyncMock(return_value=candidate),
                ), self.assertRaises(InvitationNotAccepted):
                    await accepted_provider_invitation(local)

        await run_checks()

    async def test_uncertain_create_reconciliation_uses_local_marker_not_email_only(self) -> None:
        from app.services.invitation_service import _find_uncertain_provider_invitation

        local_id = uuid4()
        invitation = SimpleNamespace(
            id=local_id,
            email="same@example.test",
            delivery_started_at=datetime.now(timezone.utc),
        )
        matching = SimpleNamespace(
            id="inv_local",
            email_address="same@example.test",
            public_metadata={"ddc_invitation_id": str(local_id)},
        )
        unrelated = SimpleNamespace(
            id="inv_dashboard",
            email_address="same@example.test",
            public_metadata={},
        )

        async def list_async(*, status, **kwargs):
            return [matching, unrelated] if status is None else []

        fake_client = SimpleNamespace(invitations=SimpleNamespace(list_async=list_async))
        with patch("app.services.invitation_service.clerk_service.get_clerk", return_value=fake_client):
            self.assertIs(await _find_uncertain_provider_invitation(invitation), matching)

    async def test_unavailable_reconciliation_never_replays_an_uncertain_create(self) -> None:
        from app.models.user_invitation import InvitationStatus
        from app.services.invitation_service import InvitationDeliveryUncertain, deliver_invitation

        invitation_id = uuid4()
        actor = SimpleNamespace(
            id=uuid4(),
            role="admin",
            status="active",
            clerk_deleted_at=None,
        )
        invitation = SimpleNamespace(
            id=invitation_id,
            email="same@example.test",
            assigned_role="member",
            status=InvitationStatus.FAILED.value,
            expires_at=None,
            delivery_attempts=1,
            delivery_started_at=datetime.now(timezone.utc),
            clerk_invitation_id=None,
            failed_at=None,
            failure_reason=None,
        )
        invitations_api = SimpleNamespace(
            list_async=AsyncMock(side_effect=RuntimeError("provider unavailable")),
            create_async=AsyncMock(),
        )
        db = SimpleNamespace(
            execute=AsyncMock(),
            scalar=AsyncMock(side_effect=[actor, invitation]),
            commit=AsyncMock(),
        )

        with patch(
            "app.services.invitation_service.clerk_service.get_clerk",
            return_value=SimpleNamespace(invitations=invitations_api),
        ), self.assertRaises(InvitationDeliveryUncertain):
            await deliver_invitation(db, invitation, actor_id=actor.id)

        invitations_api.create_async.assert_not_awaited()
        self.assertEqual(invitation.status, InvitationStatus.FAILED.value)
        self.assertEqual(invitation.failure_reason, "provider_reconciliation_uncertain")

    async def test_auth_rejects_deleted_clerk_identity_even_if_local_status_is_active(self) -> None:
        from app.auth.dependencies import get_current_db_user

        deleted_active_user = SimpleNamespace(
            clerk_deleted_at=datetime.now(timezone.utc),
            status="active",
        )
        state = SimpleNamespace(payload={"sub": "user_deleted"})
        with patch(
            "app.auth.dependencies.get_by_clerk_id",
            new=AsyncMock(return_value=deleted_active_user),
        ), self.assertRaises(HTTPException) as raised:
            await get_current_db_user(state, object())
        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.detail["reason"], "clerk_identity_deleted")

    async def test_sync_persists_provider_revocation_before_returning_access_denial(self) -> None:
        from app.routers.users import sync_current_clerk_user
        from app.services.invitation_service import InvitationNotAccepted

        state = SimpleNamespace(payload={"sub": "user_revoked_invite"})
        db = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
        provider_user = {"id": "user_revoked_invite"}
        with (
            patch("app.routers.users.clerk_service.get_clerk_user", new=AsyncMock(return_value=provider_user)),
            patch(
                "app.routers.users.clerk_onboarding_service.synchronize_clerk_identity",
                new=AsyncMock(side_effect=InvitationNotAccepted),
            ),
            self.assertRaises(HTTPException) as raised,
        ):
            await sync_current_clerk_user(clerk_state=state, db=db)
        self.assertEqual(raised.exception.status_code, 409)
        db.commit.assert_awaited_once()
        db.rollback.assert_not_awaited()

    async def test_bootstrap_requires_a_verified_primary_identity(self) -> None:
        from app.auth.permissions import Role, is_role_demotion
        from scripts import bootstrap_superadmin

        self.assertTrue(is_role_demotion(Role.ADMIN, Role.OFFICIAL))
        self.assertFalse(is_role_demotion(Role.MEMBER, Role.ADMIN))
        self.assertFalse(is_role_demotion(Role.SUPERADMIN, Role.SUPERADMIN))
        with patch(
            "scripts.bootstrap_superadmin.clerk_service.find_verified_clerk_user_by_primary_email",
            new=AsyncMock(return_value=None),
        ), self.assertRaises(bootstrap_superadmin.BootstrapRefused):
            await bootstrap_superadmin.bootstrap_first_superadmin("unverified@example.test")


if __name__ == "__main__":
    unittest.main()
