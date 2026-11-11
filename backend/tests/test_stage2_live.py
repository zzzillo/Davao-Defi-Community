"""Opt-in Stage 2 API integration tests against the isolated test database.

Run only after validating and migrating backend/.env.test:

    RUN_STAGE2_LIVE_TESTS=true .venv/bin/python -m unittest tests.test_stage2_live -v

The Clerk identity dependency is the only request dependency overridden. The
database authentication, authorization, routes, services, and transaction
behavior all run normally.
"""

from __future__ import annotations

import asyncio
import os
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

from dotenv import dotenv_values, load_dotenv
from fastapi import Request
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import Role
from app.config import validate_test_database_url
from app.models.activity_log import ActivityAction, ActivityAudience, ActivityLog, ActivityResource
from app.models.blog import Blog
from app.models.event import Event
from app.models.partner import Partner
from app.models.post import Post
from app.models.user import AccountStatus, User


BACKEND_DIR = Path(__file__).resolve().parents[1]


@unittest.skipUnless(
    os.getenv("RUN_STAGE2_LIVE_TESTS") == "true",
    "set RUN_STAGE2_LIVE_TESTS=true to opt in to isolated Neon integration tests",
)
class Stage2LiveApiTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # Load the original application URL first so the validator can reject a
        # test target pointing at the application database. Never print either.
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
        # Only after the guard compares against DATABASE_URL do we point the
        # lazy app engine at the isolated test target.
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

        # Each IsolatedAsyncioTestCase gets its own event loop. Dispose pooled
        # connections between cases so no async driver connection crosses loops;
        # within each case the normal pool remains reused across requests.
        await self.engine.dispose()

        self.prefix = f"stage2-{uuid4().hex[:10]}"
        self.users: dict[str, User] = {}
        self.content_ids: dict[str, object] = {}
        async with self.session_factory() as db:
            for name, role in (
                ("member", Role.MEMBER),
                ("official", Role.OFFICIAL),
                ("admin", Role.ADMIN),
                ("superadmin", Role.SUPERADMIN),
                ("superadmin2", Role.SUPERADMIN),
                ("other_member", Role.MEMBER),
                ("other_admin", Role.ADMIN),
            ):
                user = User(
                    clerk_user_id=f"{self.prefix}-{name}",
                    email=f"{self.prefix}-{name}@example.test",
                    display_name=f"{self.prefix} {name}",
                    role=role.value,
                    # Legacy permission data is intentionally present on a
                    # member to prove it cannot expand the fixed role map.
                    permissions=["events.create", "users.read"] if name == "member" else [],
                )
                db.add(user)
                self.users[name] = user
            await db.flush()

            now = datetime.now(timezone.utc)
            own_published = Blog(
                title=f"{self.prefix} Member published",
                slug=f"{self.prefix}-member-published",
                excerpt="Published excerpt",
                content="<p>Published body</p>",
                published=True,
                published_at=now,
                creator_id=self.users["member"].id,
            )
            own_draft = Blog(
                title=f"{self.prefix} Member draft",
                slug=f"{self.prefix}-member-draft",
                excerpt="Draft excerpt",
                content="<p>Draft body</p>",
                published=False,
                creator_id=self.users["member"].id,
            )
            other_draft = Blog(
                title=f"{self.prefix} Other draft",
                slug=f"{self.prefix}-other-draft",
                excerpt="Other draft excerpt",
                content="<p>Other body</p>",
                published=False,
                creator_id=self.users["other_member"].id,
            )
            published_event = Event(
                title=f"{self.prefix} Published event",
                start_datetime=now + timedelta(days=10),
                published=True,
                creator_id=self.users["member"].id,
            )
            draft_event = Event(
                title=f"{self.prefix} Draft event",
                start_datetime=now + timedelta(days=11),
                published=False,
                creator_id=self.users["member"].id,
            )
            published_post = Post(
                title=f"{self.prefix} Published recap",
                post_date=date.today(),
                published=True,
                creator_id=self.users["member"].id,
            )
            draft_post = Post(
                title=f"{self.prefix} Draft recap",
                post_date=date.today(),
                published=False,
                creator_id=self.users["member"].id,
            )
            partner = Partner(
                name=f"{self.prefix} Partner",
                creator_id=self.users["member"].id,
            )
            published_post.event = draft_event
            db.add_all([own_published, own_draft, other_draft, published_event, draft_event, published_post, draft_post, partner])
            await db.flush()
            self.content_ids.update(
                own_published=own_published.id,
                own_draft=own_draft.id,
                other_draft=other_draft.id,
                published_event=published_event.id,
                draft_event=draft_event.id,
                published_post=published_post.id,
                draft_post=draft_post.id,
                partner=partner.id,
            )
            db.add_all(
                [
                    ActivityLog(
                        user_id=self.users["member"].id,
                        owner_id=self.users["member"].id,
                        audience=ActivityAudience.PRIVATE.value,
                        action=ActivityAction.CREATED.value,
                        resource=ActivityResource.BLOG.value,
                        resource_id=own_draft.id,
                        details={"title": own_draft.title},
                    ),
                    ActivityLog(
                        user_id=self.users["other_member"].id,
                        owner_id=self.users["other_member"].id,
                        audience=ActivityAudience.PRIVATE.value,
                        action=ActivityAction.CREATED.value,
                        resource=ActivityResource.BLOG.value,
                        resource_id=other_draft.id,
                        details={"title": other_draft.title},
                    ),
                    ActivityLog(
                        user_id=self.users["official"].id,
                        owner_id=self.users["member"].id,
                        audience=ActivityAudience.SHARED.value,
                        action=ActivityAction.CREATED.value,
                        resource=ActivityResource.EVENT.value,
                        resource_id=draft_event.id,
                        details={"title": draft_event.title},
                    ),
                    ActivityLog(
                        user_id=self.users["superadmin"].id,
                        owner_id=self.users["other_admin"].id,
                        audience=ActivityAudience.USER_MANAGEMENT.value,
                        action=ActivityAction.PROMOTED.value,
                        resource=ActivityResource.USER.value,
                        resource_id=self.users["other_admin"].id,
                        details={"from": "member", "to": "admin"},
                    ),
                ]
            )
            await db.commit()
        async def fake_verified_identity(request: Request):
            clerk_id = request.headers.get("x-test-clerk-id", "")
            return SimpleNamespace(
                payload={
                    "sub": clerk_id,
                    # A signed identity dependency override intentionally carries
                    # a false superadmin claim. Authorization must ignore it.
                    "metadata": {"role": "superadmin", "permissions": ["*"]},
                }
            )

        self.app.dependency_overrides[get_current_clerk_user] = fake_verified_identity
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app), base_url="http://test"
        )

    async def asyncTearDown(self) -> None:
        await self.client.aclose()
        async with self.session_factory() as db:
            user_ids = [user.id for user in self.users.values()]
            content_ids = [UUID(str(value)) for value in self.content_ids.values()]
            await db.execute(
                delete(ActivityLog).where(
                    or_(
                        ActivityLog.user_id.in_(user_ids),
                        ActivityLog.owner_id.in_(user_ids),
                        ActivityLog.resource_id.in_(user_ids + content_ids),
                    )
                )
            )
            await db.execute(delete(Post).where(Post.id.in_(content_ids)))
            await db.execute(delete(Blog).where(Blog.id.in_(content_ids)))
            await db.execute(delete(Event).where(Event.id.in_(content_ids)))
            await db.execute(delete(Partner).where(Partner.id.in_(content_ids)))
            await db.execute(delete(User).where(User.id.in_(user_ids)))
            await db.commit()
        await self.engine.dispose()

    def headers(self, user_name: str) -> dict[str, str]:
        return {"x-test-clerk-id": self.users[user_name].clerk_user_id}

    async def test_db_role_public_publication_management_scope_and_contributor_privacy(self) -> None:
        me = await self.client.get("/users/me", headers=self.headers("member"))
        self.assertEqual(me.status_code, 200, me.text)
        self.assertEqual(me.json()["role"], "member")

        # Authenticated public routes remain publication-only, even with a
        # fabricated superadmin JWT metadata claim and the obsolete query flag.
        for path, key, expected_title in (
            ("/blogs?include_drafts=true", "title", f"{self.prefix} Member published"),
            ("/events?include_drafts=true", "title", f"{self.prefix} Published event"),
            ("/posts?include_drafts=true", "title", f"{self.prefix} Published recap"),
        ):
            response = await self.client.get(path, headers=self.headers("official"))
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual([item[key] for item in response.json()["items"]], [expected_title])
            if path.startswith("/posts"):
                self.assertIsNone(response.json()["items"][0]["event"])
        public_post = await self.client.get(
            f"/posts/{self.content_ids['published_post']}", headers=self.headers("official")
        )
        self.assertEqual(public_post.status_code, 200, public_post.text)
        self.assertIsNone(public_post.json()["event"])
        managed_posts = await self.client.get("/admin/posts", headers=self.headers("official"))
        self.assertEqual(managed_posts.status_code, 200, managed_posts.text)
        managed_recap = next(
            item for item in managed_posts.json()["items"] if item["id"] == str(self.content_ids["published_post"])
        )
        self.assertEqual(managed_recap["event"]["published"], False)
        for route, draft_id, user_name in (
            ("/blogs", self.content_ids["own_draft"], "official"),
            ("/events", self.content_ids["draft_event"], "official"),
            ("/posts", self.content_ids["draft_post"], "official"),
        ):
            response = await self.client.get(f"{route}/{draft_id}", headers=self.headers(user_name))
            self.assertEqual(response.status_code, 404, response.text)

        denied = await self.client.get("/admin/events", headers=self.headers("member"))
        self.assertEqual(denied.status_code, 403, denied.text)
        owned = await self.client.get("/admin/blogs", headers=self.headers("member"))
        self.assertEqual(owned.status_code, 200, owned.text)
        self.assertEqual(owned.json()["total"], 2)
        member_dashboard = await self.client.get("/admin/dashboard", headers=self.headers("member"))
        self.assertEqual(
            set(member_dashboard.json()["totals"]), {"blogs", "blog_drafts"}
        )
        official_dashboard = await self.client.get("/admin/dashboard", headers=self.headers("official"))
        self.assertTrue({"events", "posts", "partners"}.issubset(official_dashboard.json()["totals"]))
        admin_dashboard = await self.client.get("/admin/dashboard", headers=self.headers("admin"))
        self.assertTrue({"users", "activity"}.issubset(admin_dashboard.json()["totals"]))
        filtered = await self.client.get(
            f"/admin/blogs?creator_id={self.users['other_member'].id}",
            headers=self.headers("member"),
        )
        self.assertEqual(filtered.status_code, 200, filtered.text)
        self.assertEqual(filtered.json()["total"], 0)
        other_draft = await self.client.get(
            f"/admin/blogs/{self.content_ids['other_draft']}", headers=self.headers("member")
        )
        self.assertEqual(other_draft.status_code, 404, other_draft.text)
        self.assertGreaterEqual(
            (await self.client.get("/admin/events", headers=self.headers("official"))).json()["total"],
            2,
        )

        own_patch = await self.client.patch(
            f"/blogs/{self.content_ids['other_draft']}",
            json={"title": "not the owner"},
            headers=self.headers("official"),
        )
        self.assertEqual(own_patch.status_code, 403, own_patch.text)
        extra_creator = await self.client.patch(
            f"/blogs/{self.content_ids['own_draft']}",
            json={"creator_id": str(self.users["other_member"].id)},
            headers=self.headers("member"),
        )
        self.assertEqual(extra_creator.status_code, 422, extra_creator.text)

        profile = await self.client.patch(
            "/users/me",
            json={
                "display_name": f"{self.prefix} Mika Reyes",
                "alias": f"{self.prefix}.mika",
                "public_slug": f"{self.prefix}-mika-reyes",
                "contributions": ["Community research", "Workshop host"],
                "social_links": {"portfolio": "https://example.test/mika"},
            },
            headers=self.headers("member"),
        )
        self.assertEqual(profile.status_code, 200, profile.text)
        email_edit = await self.client.patch(
            "/users/me", json={"email": "changed@example.test"}, headers=self.headers("member")
        )
        self.assertEqual(email_edit.status_code, 422, email_edit.text)
        duplicate_alias = await self.client.patch(
            "/users/me",
            json={"alias": f"{self.prefix}.mika"},
            headers=self.headers("other_member"),
        )
        self.assertEqual(duplicate_alias.status_code, 409, duplicate_alias.text)

        enabled = await self.client.patch(
            f"/admin/users/{self.users['member'].id}/directory",
            json={"positions": ["Member", "Researcher"], "show_in_contributor_directory": True, "contributor_directory_order": 4},
            headers=self.headers("admin"),
        )
        self.assertEqual(enabled.status_code, 200, enabled.text)
        other_name = await self.client.patch(
            "/users/me",
            json={"display_name": f"{self.prefix} Mika Reyes"},
            headers=self.headers("other_member"),
        )
        self.assertEqual(other_name.status_code, 200, other_name.text)
        other_slug, collision = await asyncio.gather(
            self.client.patch(
                "/users/me",
                json={"public_slug": f"{self.prefix}-other-contributor"},
                headers=self.headers("other_member"),
            ),
            self.client.patch(
                f"/admin/users/{self.users['other_member'].id}/directory",
                json={"positions": ["Volunteer"], "show_in_contributor_directory": True, "contributor_directory_order": 5},
                headers=self.headers("admin"),
            ),
        )
        self.assertEqual(collision.status_code, 200, collision.text)
        self.assertIn(other_slug.status_code, {200, 409}, other_slug.text)
        self.assertIn(
            collision.json()["public_slug"],
            {f"{self.prefix}-other-contributor", f"{self.prefix}-mika-reyes-2"},
        )
        public = await self.client.get("/users/contributors", headers=self.headers("member"))
        self.assertEqual(public.status_code, 200, public.text)
        contributor = next(
            item for item in public.json()["items"] if item["public_slug"] == f"{self.prefix}-mika-reyes"
        )
        self.assertTrue(
            {"email", "role", "status", "clerk_user_id", "id"}.isdisjoint(contributor)
        )
        self.assertEqual(contributor["alias"], f"{self.prefix}.mika")
        articles = await self.client.get(
            f"/users/contributors/{self.prefix}-mika-reyes/blogs?include_drafts=true"
        )
        self.assertEqual(articles.status_code, 200, articles.text)
        self.assertEqual(articles.json()["total"], 1)
        immutable = await self.client.patch(
            "/users/me", json={"public_slug": f"{self.prefix}-new-slug"}, headers=self.headers("member")
        )
        self.assertEqual(immutable.status_code, 409, immutable.text)

        peer_directory = await self.client.patch(
            f"/admin/users/{self.users['other_admin'].id}/directory",
            json={"positions": ["Board"], "show_in_contributor_directory": False, "contributor_directory_order": None},
            headers=self.headers("admin"),
        )
        self.assertEqual(peer_directory.status_code, 200, peer_directory.text)

        member_logs = await self.client.get("/activity-logs", headers=self.headers("member"))
        member_titles = [entry.get("details", {}).get("title") for entry in member_logs.json()["items"]]
        self.assertIn(f"{self.prefix} Member draft", member_titles)
        self.assertNotIn(f"{self.prefix} Other draft", member_titles)
        self.assertNotIn(f"{self.prefix} Draft event", member_titles)
        official_logs = await self.client.get("/activity-logs", headers=self.headers("official"))
        self.assertTrue(
            any(
                entry.get("details", {}).get("title") == f"{self.prefix} Draft event"
                for entry in official_logs.json()["items"]
            )
        )
        admin_logs = await self.client.get("/activity-logs", headers=self.headers("admin"))
        admin_titles = [entry.get("details", {}).get("title") for entry in admin_logs.json()["items"]]
        self.assertNotIn(f"{self.prefix} Other draft", admin_titles)
        self.assertTrue(
            any(
                entry["action"] == "updated_directory"
                and entry["resource_id"] == str(self.users["other_admin"].id)
                for entry in admin_logs.json()["items"]
            )
        )
        self.assertFalse(
            any(
                entry.get("details", {}).get("to") == "admin"
                and entry["resource_id"] == str(self.users["other_admin"].id)
                for entry in admin_logs.json()["items"]
            )
        )
        superadmin_logs = await self.client.get("/activity-logs", headers=self.headers("superadmin"))
        superadmin_titles = [entry.get("details", {}).get("title") for entry in superadmin_logs.json()["items"]]
        self.assertIn(f"{self.prefix} Other draft", superadmin_titles)

        deleted = await self.client.delete(
            f"/events/{self.content_ids['draft_event']}", headers=self.headers("official")
        )
        self.assertEqual(deleted.status_code, 204, deleted.text)
        async with self.session_factory() as db:
            deleted_log = await db.scalar(
                select(ActivityLog).where(
                    ActivityLog.resource_id == self.content_ids["draft_event"],
                    ActivityLog.action == ActivityAction.DELETED.value,
                )
            )
            self.assertEqual(deleted_log.owner_id, self.users["member"].id)
            self.assertEqual(deleted_log.user_id, self.users["official"].id)

        created_event = await self.client.post(
            "/events",
            json={
                "title": f"{self.prefix} Created event",
                "start_datetime": (datetime.now(timezone.utc) + timedelta(days=20)).isoformat(),
                "published": False,
            },
            headers=self.headers("official"),
        )
        self.assertEqual(created_event.status_code, 201, created_event.text)
        self.assertEqual(created_event.json()["creator"]["id"], str(self.users["official"].id))
        creator_change = await self.client.patch(
            f"/events/{created_event.json()['id']}",
            json={"creator_id": str(self.users["member"].id)},
            headers=self.headers("superadmin"),
        )
        self.assertEqual(creator_change.status_code, 422, creator_change.text)
        self.content_ids["api_event"] = created_event.json()["id"]

        created_partner = await self.client.post(
            "/partners",
            json={"name": f"{self.prefix} API partner"},
            headers=self.headers("official"),
        )
        self.assertEqual(created_partner.status_code, 201, created_partner.text)
        self.assertEqual(created_partner.json()["creator"]["id"], str(self.users["official"].id))
        partner_creator_change = await self.client.patch(
            f"/partners/{created_partner.json()['id']}",
            json={"creator_id": str(self.users["member"].id)},
            headers=self.headers("superadmin"),
        )
        self.assertEqual(partner_creator_change.status_code, 422, partner_creator_change.text)
        self.content_ids["api_partner"] = created_partner.json()["id"]

    async def test_role_status_guards_and_concurrent_superadmin_serialization(self) -> None:
        self_change = await self.client.patch(
            f"/admin/users/{self.users['admin'].id}/role",
            json={"role": "member"},
            headers=self.headers("admin"),
        )
        self.assertEqual(self_change.status_code, 403, self_change.text)
        for attempted_role in ("admin", "superadmin"):
            escalation = await self.client.patch(
                f"/admin/users/{self.users['member'].id}/role",
                json={"role": attempted_role},
                headers=self.headers("admin"),
            )
            self.assertEqual(escalation.status_code, 403, escalation.text)
        elevated_payload = await self.client.patch(
            f"/admin/users/{self.users['member'].id}/role",
            json={"role": "official", "permissions": ["users.read"]},
            headers=self.headers("admin"),
        )
        self.assertEqual(elevated_payload.status_code, 422, elevated_payload.text)
        elevated = await self.client.patch(
            f"/admin/users/{self.users['member'].id}/role",
            json={"role": "official"},
            headers=self.headers("admin"),
        )
        self.assertEqual(elevated.status_code, 200, elevated.text)
        managed_activity = await self.client.get("/activity-logs", headers=self.headers("admin"))
        self.assertTrue(
            any(
                entry["action"] == "promoted"
                and entry["resource_id"] == str(self.users["member"].id)
                for entry in managed_activity.json()["items"]
            )
        )
        blocked_peer = await self.client.patch(
            f"/admin/users/{self.users['other_admin'].id}/role",
            json={"role": "official"},
            headers=self.headers("admin"),
        )
        self.assertEqual(blocked_peer.status_code, 403, blocked_peer.text)
        blocked_superadmin_profile = await self.client.patch(
            f"/admin/users/{self.users['superadmin'].id}/profile",
            json={"display_name": "Forbidden"},
            headers=self.headers("admin"),
        )
        self.assertEqual(blocked_superadmin_profile.status_code, 403, blocked_superadmin_profile.text)

        async def demote(actor: str, target: str):
            return await self.client.patch(
                f"/admin/users/{self.users[target].id}/role",
                json={"role": "admin"},
                headers=self.headers(actor),
            )

        first, second = await asyncio.gather(
            demote("superadmin", "superadmin2"),
            demote("superadmin2", "superadmin"),
        )
        self.assertCountEqual([first.status_code, second.status_code], [200, 403])
        async with self.session_factory() as db:
            active_superadmins = await db.scalar(
                select(func.count()).select_from(User).where(
                    User.role == Role.SUPERADMIN.value,
                    User.status == AccountStatus.ACTIVE.value,
                )
            )
            self.assertEqual(active_superadmins, 1)

        # The remaining SA cannot deactivate itself, while a request started
        # by the concurrently demoted peer no longer has SA authority.
        async with self.session_factory() as db:
            survivor = await db.scalar(
                select(User).where(
                    User.role == Role.SUPERADMIN.value,
                    User.status == AccountStatus.ACTIVE.value,
                    User.id.in_([self.users["superadmin"].id, self.users["superadmin2"].id]),
                )
            )
        self.assertIsNotNone(survivor)
        self_deactivate = await self.client.patch(
            f"/admin/users/{survivor.id}/status",
            json={"status": "suspended"},
            headers={"x-test-clerk-id": survivor.clerk_user_id},
        )
        self.assertEqual(self_deactivate.status_code, 403, self_deactivate.text)

        suspended = await self.client.patch(
            f"/admin/users/{self.users['other_member'].id}/status",
            json={"status": "suspended"},
            headers=self.headers("admin"),
        )
        self.assertEqual(suspended.status_code, 200, suspended.text)
        rejected = await self.client.get("/users/me", headers=self.headers("other_member"))
        self.assertEqual(rejected.status_code, 403, rejected.text)

    async def test_mutation_and_audit_log_roll_back_together(self) -> None:
        from app.services import activity_log_service

        original_title = f"{self.prefix} Published event"
        with patch.object(activity_log_service, "log_activity", side_effect=RuntimeError("audit unavailable")):
            response = await self.client.patch(
                f"/events/{self.content_ids['published_event']}",
                json={"title": "Should roll back"},
                headers=self.headers("official"),
            )
        self.assertEqual(response.status_code, 500, response.text)
        async with self.session_factory() as db:
            event = await db.get(Event, self.content_ids["published_event"])
            self.assertEqual(event.title, original_title)
            audit = await db.scalar(
                select(func.count()).select_from(ActivityLog).where(
                    ActivityLog.resource_id == self.content_ids["published_event"],
                    ActivityLog.details["title"].astext == "Should roll back",
                )
            )
            self.assertEqual(audit or 0, 0)


if __name__ == "__main__":
    unittest.main()
