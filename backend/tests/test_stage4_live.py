"""Guarded Stage 4 upload and media-authorization checks on isolated Neon.

Run only after backend/.env.test has been validated and migrated:

    RUN_STAGE4_LIVE_TESTS=true .venv/bin/python -m unittest tests.test_stage4_live -v

Clerk identity and the R2 S3 client are mocked. No image is sent to a real
provider, and the real application database is never selected by this suite.
"""

from __future__ import annotations

import asyncio
import io
import os
import unittest
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from dotenv import dotenv_values, load_dotenv
from fastapi import Request
from sqlalchemy import delete, select

from app.auth.permissions import Role
from app.config import Settings, validate_test_database_url
from app.models.activity_log import ActivityAudience, ActivityLog
from app.models.blog import Blog
from app.models.event import Event
from app.models.media_asset import MediaAsset
from app.models.partner import Partner
from app.models.post import Post
from app.models.user import AccountStatus, User
from app.services.media_service import MAX_UPLOAD_BYTES

BACKEND_DIR = Path(__file__).resolve().parents[1]


@unittest.skipUnless(
    os.getenv("RUN_STAGE4_LIVE_TESTS") == "true",
    "set RUN_STAGE4_LIVE_TESTS=true to opt in to isolated Neon media tests",
)
class Stage4LiveMediaTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
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
        # Validate the isolated target before redirecting the lazy app engine.
        validate_test_database_url(str(test_url))
        os.environ["DATABASE_URL"] = str(test_url)

        from app.config import get_settings
        from app.database import _get_session_factory, get_engine
        from app.main import app

        get_settings.cache_clear()
        get_engine.cache_clear()
        _get_session_factory.cache_clear()
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
        self.prefix = f"stage4-{uuid4().hex[:10]}"
        self.users: dict[str, User] = {}
        self.app.dependency_overrides.clear()
        async with self.session_factory() as db:
            for suffix, role in (
                ("member", Role.MEMBER),
                ("other_member", Role.MEMBER),
                ("official", Role.OFFICIAL),
                ("other_official", Role.OFFICIAL),
                ("admin", Role.ADMIN),
                ("superadmin", Role.SUPERADMIN),
            ):
                user = User(
                    clerk_user_id=f"{self.prefix}-{suffix}",
                    email=f"{self.prefix}-{suffix}@example.test",
                    display_name=f"{self.prefix} {suffix}",
                    role=role.value,
                    status=AccountStatus.ACTIVE.value,
                    permissions=[],
                )
                db.add(user)
                self.users[suffix] = user
            await db.flush()
            self.user_ids = {name: user.id for name, user in self.users.items()}
            await db.commit()

        async def fake_verified_identity(request: Request):
            clerk_id = request.headers.get("x-test-clerk-id", "")
            return SimpleNamespace(
                payload={
                    "sub": clerk_id,
                    "metadata": {"role": "superadmin", "permissions": ["*"]},
                },
                is_authenticated=True,
            )

        self.app.dependency_overrides[get_current_clerk_user] = fake_verified_identity
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app),
            base_url="http://testserver",
        )

    async def asyncTearDown(self) -> None:
        await self.client.aclose()
        async with self.session_factory() as db:
            user_ids = list(self.user_ids.values())
            await db.execute(
                delete(ActivityLog).where(
                    ActivityLog.user_id.in_(user_ids) | ActivityLog.owner_id.in_(user_ids)
                )
            )
            await db.execute(delete(Blog).where(Blog.creator_id.in_(user_ids)))
            await db.execute(delete(Partner).where(Partner.creator_id.in_(user_ids)))
            await db.execute(delete(Post).where(Post.creator_id.in_(user_ids)))
            await db.execute(delete(Event).where(Event.creator_id.in_(user_ids)))
            await db.execute(delete(MediaAsset).where(MediaAsset.uploaded_by_user_id.in_(user_ids)))
            await db.execute(delete(User).where(User.id.in_(user_ids)))
            await db.commit()
        self.app.dependency_overrides.clear()
        from app.services.storage_service import _make_r2_client

        _make_r2_client.cache_clear()

    def headers(self, user: str) -> dict[str, str]:
        return {"x-test-clerk-id": f"{self.prefix}-{user}"}

    @contextmanager
    def fake_r2(self):
        from app.services import storage_service

        settings = Settings(
            database_url=None,
            clerk_secret_key=None,
            clerk_issuer_url=None,
            clerk_webhook_signing_secret=None,
            storage_public_base_url="https://media.example.test/dev",
            r2_account_id="b2" * 16,
            r2_access_key_id="access-placeholder",
            r2_secret_access_key="secret-placeholder",
            r2_bucket_name="ddc-stage4-test",
            allowed_origins=(),
        )
        fake_client = Mock()
        with (
            patch.object(storage_service, "get_settings", return_value=settings),
            patch.object(
                storage_service,
                "get_public_base_url",
                return_value=settings.storage_public_base_url,
            ),
            patch.object(storage_service.boto3, "client", return_value=fake_client) as factory,
        ):
            storage_service._make_r2_client.cache_clear()
            try:
                yield fake_client, factory
            finally:
                storage_service._make_r2_client.cache_clear()

    @staticmethod
    def image_bytes(fmt: str = "PNG") -> bytes:
        from PIL import Image

        image = Image.new("RGB", (14, 10), (40, 90, 130))
        output = io.BytesIO()
        image.save(output, format=fmt)
        return output.getvalue()

    async def test_upload_is_registered_after_provider_write_and_private_blog_scope_is_enforced(self) -> None:
        with self.fake_r2() as (provider, client_factory):
            upload = await self.client.post(
                "/media/uploads?purpose=blog_cover",
                content=self.image_bytes(),
                headers={**self.headers("member"), "content-type": "image/png"},
            )
            self.assertEqual(upload.status_code, 201, upload.text)
            result = upload.json()
            self.assertEqual(result["purpose"], "blog_cover")
            self.assertEqual(result["validation_status"], "valid")
            self.assertEqual(result["public_url"], f"https://media.example.test/dev/{result['storage_key']}")
            self.assertNotIn("access-placeholder", upload.text)
            self.assertNotIn("secret-placeholder", upload.text)
            self.assertEqual(client_factory.call_args.kwargs["region_name"], "auto")
            provider.put_object.assert_called_once()
            stored = provider.put_object.call_args.kwargs
            self.assertEqual(stored["Bucket"], "ddc-stage4-test")
            self.assertEqual(stored["Key"], result["storage_key"])
            self.assertNotIn("ACL", stored)

            async with self.session_factory() as db:
                asset = await db.scalar(
                    select(MediaAsset).where(MediaAsset.storage_key == result["storage_key"])
                )
                activity = await db.scalar(
                    select(ActivityLog).where(ActivityLog.resource_id == result["id"])
                )
                self.assertIsNotNone(asset.validated_at)
                self.assertEqual(asset.uploaded_by_user_id, self.user_ids["member"])
                self.assertEqual(
                    asset.metadata_json["scope_owner_id"], str(self.user_ids["member"])
                )
                self.assertEqual(activity.audience, ActivityAudience.PRIVATE.value)
                self.assertEqual(activity.owner_id, self.user_ids["member"])
                self.assertNotIn("url", activity.details)

            created = await self.client.post(
                "/blogs",
                json={"title": f"{self.prefix} own", "cover_image_key": result["storage_key"]},
                headers=self.headers("member"),
            )
            self.assertEqual(created.status_code, 201, created.text)
            denied = await self.client.post(
                "/blogs",
                json={"title": f"{self.prefix} other", "cover_image_key": result["storage_key"]},
                headers=self.headers("other_member"),
            )
            self.assertEqual(denied.status_code, 422, denied.text)
            self.assertEqual(denied.json()["detail"]["reason"], "media_asset_scope_mismatch")

    async def test_rejects_shared_member_uploads_oversize_mime_spoof_and_unknown_keys(self) -> None:
        with self.fake_r2() as (provider, _):
            shared = await self.client.post(
                "/media/uploads?purpose=partner_logo",
                content=self.image_bytes(),
                headers={**self.headers("member"), "content-type": "image/png"},
            )
            self.assertEqual(shared.status_code, 403, shared.text)

            oversized = await self.client.post(
                "/media/uploads?purpose=blog_cover",
                content=b"x" * (MAX_UPLOAD_BYTES + 1),
                headers={**self.headers("member"), "content-type": "image/png"},
            )
            self.assertEqual(oversized.status_code, 413, oversized.text)

            spoofed = await self.client.post(
                "/media/uploads?purpose=blog_cover",
                content=self.image_bytes("JPEG"),
                headers={**self.headers("member"), "content-type": "image/png"},
            )
            self.assertEqual(spoofed.status_code, 422, spoofed.text)

            unknown = await self.client.post(
                "/blogs",
                json={"title": f"{self.prefix} unknown", "cover_image_key": "blogs/unknown/cover.jpg"},
                headers=self.headers("member"),
            )
            self.assertEqual(unknown.status_code, 422, unknown.text)
            self.assertEqual(unknown.json()["detail"]["reason"], "media_asset_not_found")

            empty_settings = Settings(
                database_url=None,
                clerk_secret_key=None,
                clerk_issuer_url=None,
                clerk_webhook_signing_secret=None,
                storage_public_base_url="",
                r2_account_id=None,
                r2_access_key_id=None,
                r2_secret_access_key=None,
                r2_bucket_name=None,
                allowed_origins=(),
            )
            from app.services import storage_service

            with patch.object(storage_service, "get_settings", return_value=empty_settings):
                missing_config = await self.client.post(
                    "/media/uploads?purpose=blog_cover",
                    content=self.image_bytes(),
                    headers={**self.headers("member"), "content-type": "image/png"},
                )
            self.assertEqual(missing_config.status_code, 503, missing_config.text)
            self.assertEqual(
                missing_config.json()["detail"]["reason"], "media_storage_not_configured"
            )

            async def too_many_chunks():
                yield b"x" * (MAX_UPLOAD_BYTES // 2)
                yield b"x" * (MAX_UPLOAD_BYTES // 2 + 1)

            chunked_oversized = await self.client.post(
                "/media/uploads?purpose=blog_cover",
                content=too_many_chunks(),
                headers={**self.headers("member"), "content-type": "image/png"},
            )
            self.assertEqual(chunked_oversized.status_code, 413, chunked_oversized.text)

            image = self.image_bytes()

            async def demote_during_upload():
                midpoint = len(image) // 2
                yield image[:midpoint]
                changed_role = await self.client.patch(
                    f"/admin/users/{self.user_ids['official']}/role",
                    json={"role": "member"},
                    headers=self.headers("admin"),
                )
                self.assertEqual(changed_role.status_code, 200, changed_role.text)
                yield image[midpoint:]

            demoted_during_stream = await self.client.post(
                "/media/uploads?purpose=event_banner",
                content=demote_during_upload(),
                headers={**self.headers("official"), "content-type": "image/png"},
            )
            self.assertEqual(demoted_during_stream.status_code, 403, demoted_during_stream.text)
            self.assertEqual(
                demoted_during_stream.json()["detail"]["reason"],
                "shared_media_upload_requires_official",
            )
            provider.put_object.assert_not_called()

    async def test_shared_asset_uploaded_by_one_official_can_be_attached_by_another(self) -> None:
        with self.fake_r2() as (provider, _):
            upload = await self.client.post(
                "/media/uploads?purpose=partner_logo",
                content=self.image_bytes("WEBP"),
                headers={**self.headers("official"), "content-type": "image/webp"},
            )
            self.assertEqual(upload.status_code, 201, upload.text)
            result = upload.json()
            async with self.session_factory() as db:
                activity = await db.scalar(
                    select(ActivityLog).where(ActivityLog.resource_id == result["id"])
                )
                self.assertEqual(activity.audience, ActivityAudience.SHARED.value)

            attached = await self.client.post(
                "/partners",
                json={"name": f"{self.prefix} partner", "logo_key": result["storage_key"]},
                headers=self.headers("other_official"),
            )
            self.assertEqual(attached.status_code, 201, attached.text)
            self.assertEqual(provider.put_object.call_count, 1)

            event_upload = await self.client.post(
                "/media/uploads?purpose=event_banner",
                content=self.image_bytes("JPEG"),
                headers={**self.headers("official"), "content-type": "image/jpeg"},
            )
            self.assertEqual(event_upload.status_code, 201, event_upload.text)
            event_key = event_upload.json()["storage_key"]
            event = await self.client.post(
                "/events",
                json={
                    "title": f"{self.prefix} event",
                    "start_datetime": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
                    "banner_image_key": event_key,
                },
                headers=self.headers("other_official"),
            )
            self.assertEqual(event.status_code, 201, event.text)
            event_id = event.json()["id"]

            wrong_event_purpose = await self.client.patch(
                f"/events/{event_id}",
                json={"banner_image_key": result["storage_key"]},
                headers=self.headers("official"),
            )
            self.assertEqual(wrong_event_purpose.status_code, 422, wrong_event_purpose.text)
            unknown_event = await self.client.patch(
                f"/events/{event_id}",
                json={"banner_image_key": "events/unknown/banner.jpg"},
                headers=self.headers("official"),
            )
            self.assertEqual(unknown_event.status_code, 422, unknown_event.text)

            recap_upload = await self.client.post(
                "/media/uploads?purpose=recap_image",
                content=self.image_bytes("PNG"),
                headers={**self.headers("official"), "content-type": "image/png"},
            )
            self.assertEqual(recap_upload.status_code, 201, recap_upload.text)
            recap_key = recap_upload.json()["storage_key"]
            recap = await self.client.post(
                "/posts",
                json={
                    "title": f"{self.prefix} recap",
                    "post_date": date.today().isoformat(),
                    "images": [{"image_key": recap_key}],
                },
                headers=self.headers("other_official"),
            )
            self.assertEqual(recap.status_code, 201, recap.text)
            recap_id = recap.json()["id"]
            self.assertEqual(recap.json()["images"][0]["image_key"], recap_key)

            wrong_recap_purpose = await self.client.patch(
                f"/posts/{recap_id}",
                json={"images": [{"image_key": event_key}]},
                headers=self.headers("other_official"),
            )
            self.assertEqual(wrong_recap_purpose.status_code, 422, wrong_recap_purpose.text)
            unknown_recap = await self.client.patch(
                f"/posts/{recap_id}",
                json={"images": [{"image_key": "posts/unknown/image.jpg"}]},
                headers=self.headers("other_official"),
            )
            self.assertEqual(unknown_recap.status_code, 422, unknown_recap.text)

    async def test_targeted_profile_upload_uses_actor_as_uploader_and_target_as_owner(self) -> None:
        with self.fake_r2() as (provider, _):
            target_id = self.user_ids["member"]
            upload = await self.client.post(
                f"/media/uploads?purpose=profile_photo&owner_user_id={target_id}",
                content=self.image_bytes("JPEG"),
                headers={
                    **self.headers("admin"),
                    "content-type": "image/jpeg",
                },
            )
            self.assertEqual(upload.status_code, 201, upload.text)
            result = upload.json()
            async with self.session_factory() as db:
                asset = await db.scalar(
                    select(MediaAsset).where(MediaAsset.storage_key == result["storage_key"])
                )
                self.assertEqual(asset.uploaded_by_user_id, self.user_ids["admin"])
                self.assertEqual(asset.metadata_json["scope_owner_id"], str(target_id))

            updated = await self.client.patch(
                f"/admin/users/{target_id}/profile",
                json={"profile_photo_key": result["storage_key"]},
                headers=self.headers("admin"),
            )
            self.assertEqual(updated.status_code, 200, updated.text)
            self.assertEqual(updated.json()["profile_photo_key"], result["storage_key"])
            self.assertEqual(
                updated.json()["profile_photo_url"],
                f"https://media.example.test/dev/{result['storage_key']}",
            )

            denied = await self.client.post(
                f"/media/uploads?purpose=profile_photo&owner_user_id={self.user_ids['superadmin']}",
                content=self.image_bytes("JPEG"),
                headers={**self.headers("admin"), "content-type": "image/jpeg"},
            )
            self.assertEqual(denied.status_code, 403, denied.text)
            provider.put_object.assert_called_once()

    async def test_provider_and_audit_failures_compensate_exact_new_object(self) -> None:
        with self.fake_r2() as (provider, _):
            provider.put_object.side_effect = RuntimeError("provider URL and secret are private")
            failed = await self.client.post(
                "/media/uploads?purpose=blog_cover",
                content=self.image_bytes(),
                headers={**self.headers("member"), "content-type": "image/png"},
            )
            self.assertEqual(failed.status_code, 503, failed.text)
            self.assertNotIn("provider URL", failed.text)
            self.assertNotIn("secret", failed.text)
            provider.delete_object.assert_called_once()

            provider.put_object.side_effect = None
            provider.put_object.reset_mock()
            provider.delete_object.reset_mock()
            with patch(
                "app.routers.media.activity_log_service.log_activity",
                new=AsyncMock(side_effect=RuntimeError("audit rejected")),
            ):
                audit_failed = await self.client.post(
                    "/media/uploads?purpose=blog_cover",
                    content=self.image_bytes(),
                    headers={**self.headers("member"), "content-type": "image/png"},
                )
            self.assertEqual(audit_failed.status_code, 503, audit_failed.text)
            provider.put_object.assert_called_once()
            provider.delete_object.assert_called_once()
            async with self.session_factory() as db:
                assets = list(
                    (
                        await db.scalars(
                            select(MediaAsset).where(
                                MediaAsset.uploaded_by_user_id == self.user_ids["member"]
                            )
                        )
                    ).all()
                )
                self.assertEqual(assets, [])

    async def test_ambiguous_commit_error_retains_object_and_possible_committed_reference(self) -> None:
        from sqlalchemy.ext.asyncio import AsyncSession

        real_commit = AsyncSession.commit

        async def commit_then_raise(session):
            await real_commit(session)
            raise RuntimeError("simulated lost commit acknowledgement")

        with self.fake_r2() as (provider, _), patch.object(
            AsyncSession, "commit", new=commit_then_raise
        ):
            response = await self.client.post(
                "/media/uploads?purpose=blog_cover",
                content=self.image_bytes(),
                headers={**self.headers("member"), "content-type": "image/png"},
            )
            self.assertEqual(response.status_code, 503, response.text)
            self.assertEqual(
                response.json()["detail"]["reason"], "media_commit_uncertain"
            )
            provider.put_object.assert_called_once()
            provider.delete_object.assert_not_called()

        async with self.session_factory() as db:
            assets = list(
                (
                    await db.scalars(
                        select(MediaAsset).where(
                            MediaAsset.uploaded_by_user_id == self.user_ids["member"]
                        )
                    )
                ).all()
            )
            self.assertEqual(len(assets), 1)


if __name__ == "__main__":
    unittest.main()
