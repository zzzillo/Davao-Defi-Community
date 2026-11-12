"""Offline regression coverage for the database foundation.

These tests never connect to a database. Live database checks require an
isolated database whose name ends in ``_test`` and an explicit remote opt-in.
"""

from __future__ import annotations

import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import CheckConstraint

from app.config import normalize_database_url, validate_test_database_url
from app.models import ActivityLog, MediaAsset, User, UserInvitation
from app.models.user import AccountStatus


BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DATABASE_URL = "postgresql://tester:tester@127.0.0.1:5432/ddc_stage1_test"


class DatabaseConfigurationTests(unittest.TestCase):
    def test_database_url_normalization_is_shared_and_idempotent(self) -> None:
        self.assertEqual(
            normalize_database_url("postgres://dbuser:secret@db.example/community"),
            "postgresql+psycopg://dbuser:secret@db.example/community",
        )
        normalized = "postgresql+psycopg://dbuser:secret@db.example/community"
        self.assertEqual(normalize_database_url(normalized), normalized)

    def test_test_database_guard_rejects_remote_or_non_test_targets(self) -> None:
        with self.assertRaises(ValueError):
            validate_test_database_url("postgresql://u:p@db.example/community")
        with self.assertRaises(ValueError):
            validate_test_database_url("postgresql://u:p@127.0.0.1/community")
        with patch.dict(
            os.environ,
            {"ALLOW_REMOTE_TEST_DATABASE": "true"},
            clear=True,
        ):
            with self.assertRaises(ValueError):
                validate_test_database_url(
                    "postgresql://test:secret@ep-test.neon.tech/ddc_stage1_test"
                )
        self.assertEqual(
            validate_test_database_url(TEST_DATABASE_URL).database,
            "ddc_stage1_test",
        )
        with patch.dict(
            os.environ,
            {
                "ALLOW_REMOTE_TEST_DATABASE": "true",
                "DATABASE_URL": "postgresql://prod:secret@ep-production.neon.tech/app",
            },
        ):
            self.assertEqual(
                validate_test_database_url(
                    "postgresql://test:secret@ep-test.neon.tech/ddc_stage1_test"
                ).database,
                "ddc_stage1_test",
            )
            with self.assertRaises(ValueError):
                validate_test_database_url(
                    "postgresql://test:secret@ep-production.neon.tech/ddc_stage1_test"
                )

    def test_app_imports_and_health_fails_closed_without_external_integrations(self) -> None:
        isolated_env = os.environ.copy()
        # A developer's populated .env must never turn this offline test into
        # a connection to their application database.
        isolated_env["PYTHON_DOTENV_DISABLED"] = "1"
        for name in (
            "DATABASE_URL",
            "CLERK_SECRET_KEY",
            "CLERK_WEBHOOK_SIGNING_SECRET",
            "STORAGE_PUBLIC_BASE_URL",
            "R2_ACCOUNT_ID",
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "R2_BUCKET_NAME",
        ):
            isolated_env.pop(name, None)

        code = """
import asyncio
import httpx
from app.main import app

async def main():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        response = await client.get('/health')
        assert response.status_code == 503, response.text
        assert response.json()['detail']['reason'] == 'database_not_configured'

asyncio.run(main())
"""
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=BACKEND_DIR,
            env=isolated_env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_cors_origins_are_configurable_for_the_local_vite_port(self) -> None:
        isolated_env = os.environ.copy()
        isolated_env["ALLOWED_ORIGINS"] = (
            "http://localhost:5174,http://127.0.0.1:5174"
        )
        code = """
from app.config import get_settings
origins = get_settings().allowed_origins
assert 'http://localhost:5174' in origins
assert 'http://127.0.0.1:5174' in origins
"""
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=BACKEND_DIR,
            env=isolated_env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_clerk_authorized_parties_use_configured_origins(self) -> None:
        isolated_env = os.environ.copy()
        origins = "https://members.example,http://localhost:5174"
        isolated_env["ALLOWED_ORIGINS"] = origins
        isolated_env["CLERK_SECRET_KEY"] = "test-only-placeholder"
        isolated_env["CLERK_ISSUER_URL"] = "https://members.example"
        code = """
from unittest.mock import Mock, patch
from app.auth import dependencies

state = Mock(is_authenticated=True, payload={'iss': 'https://members.example'})
with patch.object(dependencies, 'authenticate_request', return_value=state) as verify:
    dependencies.get_current_clerk_user(object())

options = verify.call_args.args[1]
assert options.authorized_parties == ['https://members.example', 'http://localhost:5174']
"""
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=BACKEND_DIR,
            env=isolated_env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_local_test_database_file_is_ignored_and_guarded(self) -> None:
        repo_dir = BACKEND_DIR.parent
        ignored = subprocess.run(
            ["git", "check-ignore", "-q", "backend/.env.test"], cwd=repo_dir
        )
        self.assertEqual(ignored.returncode, 0)
        result = subprocess.run(
            [sys.executable, "scripts/upgrade_test_db.py", "--check-only"],
            cwd=BACKEND_DIR,
            env=os.environ.copy(),
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("no connection was opened", result.stdout)

    def test_malformed_database_url_returns_503_without_exposing_the_url(self) -> None:
        isolated_env = os.environ.copy()
        isolated_env["DATABASE_URL"] = "sqlite:///should-not-be-accepted"
        for name in ("CLERK_SECRET_KEY", "CLERK_WEBHOOK_SIGNING_SECRET"):
            isolated_env.pop(name, None)
        code = """
import asyncio
import httpx
from app.main import app

async def main():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        response = await client.get('/health')
        assert response.status_code == 503, response.text
        assert response.json()['detail']['reason'] == 'database_configuration_invalid'
        assert 'should-not-be-accepted' not in response.text

asyncio.run(main())
"""
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=BACKEND_DIR,
            env=isolated_env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_offline_alembic_sql_uses_the_environment_url_without_connecting(self) -> None:
        isolated_env = os.environ.copy()
        isolated_env["DATABASE_URL"] = TEST_DATABASE_URL
        isolated_env["MIGRATION_DATABASE_URL"] = TEST_DATABASE_URL
        isolated_env.pop("CLERK_SECRET_KEY", None)
        isolated_env.pop("CLERK_WEBHOOK_SIGNING_SECRET", None)
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
            cwd=BACKEND_DIR,
            env=isolated_env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("positions", result.stdout)
        self.assertIn("user_invitations", result.stdout)
        self.assertIn("media_assets", result.stdout)
        self.assertIn("contributor_directory_order", result.stdout)
        self.assertIn("e17a9a6c12bd", result.stdout)
        self.assertIn("b0318e2a4c71", result.stdout)
        self.assertIn("public_slug", result.stdout)
        self.assertIn("creator_id", result.stdout)
        self.assertNotIn("UPDATE users SET role", result.stdout)


class FoundationModelTests(unittest.TestCase):
    def test_user_profile_constraints_cover_roles_status_alias_and_two_positions(self) -> None:
        user_checks = {
            constraint.name
            for constraint in User.__table__.constraints
            if isinstance(constraint, CheckConstraint)
        }
        self.assertIn("ck_users_role", user_checks)
        self.assertIn("ck_users_status", user_checks)

        self.assertIn("ck_users_positions_max_two", user_checks)
        self.assertIn("alias", User.__table__.c)
        self.assertIn("email", User.__table__.c)
        self.assertIn("positions", User.__table__.c)

        self.assertEqual(AccountStatus.ACTIVE.value, "active")
        self.assertEqual(User.__table__.c.show_in_contributor_directory.default.arg, False)

    def test_superadmin_value_gains_stage_two_cumulative_permissions(self) -> None:
        from app.auth.permissions import Permission, Role, has_permission, role_at_least

        self.assertTrue(role_at_least(Role.SUPERADMIN, Role.ADMIN))
        self.assertFalse(role_at_least(Role.MEMBER, Role.SUPERADMIN))
        self.assertTrue(
            has_permission(Role.SUPERADMIN, Permission.EVENTS_DELETE)
        )
        self.assertTrue(
            has_permission(
                Role.SUPERADMIN,
                Permission.EVENTS_DELETE,
            )
        )

    def test_invitation_media_and_activity_rows_keep_their_required_scope_fields(self) -> None:
        self.assertIn("clerk_invitation_id", UserInvitation.__table__.c)
        self.assertIn("status", UserInvitation.__table__.c)
        self.assertIn("validation_status", MediaAsset.__table__.c)
        self.assertIn("metadata", MediaAsset.__table__.c)
        self.assertIn("owner_id", ActivityLog.__table__.c)
        self.assertIn("audience", ActivityLog.__table__.c)
        self.assertIn("failed_at", UserInvitation.__table__.c)
        self.assertIn("failure_reason", UserInvitation.__table__.c)


if __name__ == "__main__":
    unittest.main()
