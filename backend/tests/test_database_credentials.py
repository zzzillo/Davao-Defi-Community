from __future__ import annotations

import asyncio
import os
import runpy
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from app.config import get_migration_database_url, get_settings
from app.database import get_engine


BACKEND_DIR = Path(__file__).resolve().parents[1]


class MigrationDatabaseConfigurationTests(unittest.TestCase):
    def tearDown(self) -> None:
        get_settings.cache_clear()

    def test_production_migrations_use_separate_migration_role(self) -> None:
        environment = {
            "APP_ENV": "production",
            "DATABASE_URL": "postgresql://app_role:runtime-password@db.example/app",
            "MIGRATION_DATABASE_URL": "postgres://migration_role:migration-password@db.example/app",
        }
        with patch.dict(os.environ, environment, clear=True):
            get_settings.cache_clear()
            self.assertEqual(
                get_migration_database_url(),
                "postgresql+psycopg://migration_role:migration-password@db.example/app",
            )

    def test_production_migrations_fail_closed_without_migration_url(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "DATABASE_URL": "postgresql://app_role:runtime-password@db.example/app",
            },
            clear=True,
        ):
            get_settings.cache_clear()
            with self.assertRaisesRegex(RuntimeError, "MIGRATION_DATABASE_URL is required"):
                get_migration_database_url()

    def test_production_rejects_migration_url_using_runtime_role(self) -> None:
        shared_role_url = "postgresql://same_role:password@db.example/app"
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "DATABASE_URL": shared_role_url,
                "MIGRATION_DATABASE_URL": shared_role_url,
            },
            clear=True,
        ):
            get_settings.cache_clear()
            with self.assertRaisesRegex(RuntimeError, "separate database role"):
                get_migration_database_url()

    def test_production_requires_direct_nonpooled_migration_endpoint(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "DATABASE_URL": "postgresql://app_role:runtime-password@db-pooler.example/app",
                "MIGRATION_DATABASE_URL": "postgresql://migration_role:migration-password@db-pooler.example/app",
            },
            clear=True,
        ):
            get_settings.cache_clear()
            with self.assertRaisesRegex(RuntimeError, "direct, non-pooled endpoint"):
                get_migration_database_url()

    def test_local_development_falls_back_to_runtime_url(self) -> None:
        with patch.dict(
            os.environ,
            {"DATABASE_URL": "postgres://local_user:password@localhost/app"},
            clear=True,
        ):
            get_settings.cache_clear()
            self.assertEqual(
                get_migration_database_url(),
                "postgresql+psycopg://local_user:password@localhost/app",
            )

    def test_runtime_engine_uses_database_url_not_migration_url(self) -> None:
        runtime_url = "postgresql://app_role:runtime-password@db-pooler.example/app"
        migration_url = "postgresql://migration_role:migration-password@db.example/app"
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "DATABASE_URL": runtime_url,
                "MIGRATION_DATABASE_URL": migration_url,
            },
            clear=True,
        ):
            get_settings.cache_clear()
            get_engine.cache_clear()
            engine = get_engine()
            try:
                self.assertEqual(
                    engine.url.render_as_string(hide_password=False),
                    "postgresql+psycopg://app_role:runtime-password@db-pooler.example/app",
                )
            finally:
                asyncio.run(engine.dispose())
                get_engine.cache_clear()

    def test_test_migration_script_overrides_both_urls_for_child_process(self) -> None:
        test_url = "postgresql://tester:password@127.0.0.1:5432/app_test"
        production_url = "postgresql://owner:password@db.example/app"
        script_path = BACKEND_DIR / "scripts" / "upgrade_test_db.py"
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "RENDER": "true",
                "DATABASE_URL": "postgresql://runtime:password@db.example/app",
                "MIGRATION_DATABASE_URL": production_url,
            },
            clear=True,
        ), patch("dotenv.dotenv_values", return_value={"TEST_DATABASE_URL": test_url}):
            get_settings.cache_clear()
            namespace = runpy.run_path(str(script_path), run_name="test_upgrade_script")
            with patch.object(sys, "argv", [str(script_path)]), patch(
                "subprocess.run"
            ) as run_child:
                namespace["main"]()

        child_environment = run_child.call_args.kwargs["env"]
        self.assertEqual(child_environment["DATABASE_URL"], test_url)
        self.assertEqual(child_environment["MIGRATION_DATABASE_URL"], test_url)
        self.assertEqual(child_environment["APP_ENV"], "development")
        self.assertNotIn("RENDER", child_environment)
        self.assertNotEqual(child_environment["MIGRATION_DATABASE_URL"], production_url)


if __name__ == "__main__":
    unittest.main()
