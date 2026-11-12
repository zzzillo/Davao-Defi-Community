"""Safely migrate the explicitly configured test database, never the app DB."""

import argparse
import os
import subprocess
import sys
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.config import validate_test_database_url  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="validate the target without opening a database connection",
    )
    args = parser.parse_args()

    load_dotenv(BACKEND_DIR / ".env", override=False)
    test_settings = dotenv_values(BACKEND_DIR / ".env.test")
    test_url = test_settings.get("TEST_DATABASE_URL")
    remote_opt_in = test_settings.get("ALLOW_REMOTE_TEST_DATABASE") or "false"

    if not test_url:
        raise SystemExit("Set TEST_DATABASE_URL in backend/.env.test first.")

    # The validator compares against DATABASE_URL loaded from backend/.env and
    # requires an explicit remote-host opt-in. Never replace either application
    # URL until the check has succeeded.
    os.environ["ALLOW_REMOTE_TEST_DATABASE"] = str(remote_opt_in)
    try:
        validate_test_database_url(str(test_url))
    except ValueError as exc:
        raise SystemExit(f"Unsafe test database configuration: {exc}") from exc

    if args.check_only:
        print("Test database target passed isolation checks; no connection was opened.")
        return

    print("Applying Alembic migrations to the validated test database.")
    child_env = os.environ.copy()
    child_env["DATABASE_URL"] = str(test_url)
    # Alembic normally uses a separate owner credential in production. This
    # isolated helper must override it too so a developer's migration URL can
    # never redirect test migrations to the production database.
    child_env["MIGRATION_DATABASE_URL"] = str(test_url)
    # The target has already passed the isolated-test-database guard. Keep the
    # child in local mode so production-only credential separation checks do
    # not reject the intentionally shared test role.
    child_env["APP_ENV"] = "development"
    child_env.pop("RENDER", None)
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=child_env,
        check=True,
    )


if __name__ == "__main__":
    main()
