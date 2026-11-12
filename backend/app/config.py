"""Environment configuration shared by the app and Alembic."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from sqlalchemy.engine import URL, make_url

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


def normalize_database_url(raw_url: str, *, variable_name: str = "DATABASE_URL") -> str:
    """Normalize a supported PostgreSQL URL to the project's async driver."""
    try:
        url = make_url(raw_url.strip())
    except Exception as exc:
        raise ValueError(f"{variable_name} is not a valid SQLAlchemy URL") from exc
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")
    elif url.drivername != "postgresql+psycopg":
        raise ValueError(f"{variable_name} must use PostgreSQL with psycopg")
    return url.render_as_string(hide_password=False)


def validate_clerk_issuer_url(raw_url: str | None) -> str:
    """Return a normalized Clerk issuer URL without allowing an arbitrary path."""
    if not raw_url:
        raise ValueError("CLERK_ISSUER_URL is not configured")
    issuer = raw_url.strip().rstrip("/")
    try:
        parsed = urlsplit(issuer)
    except ValueError as exc:
        raise ValueError("CLERK_ISSUER_URL must be a valid HTTPS origin") from exc
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in ("", "/")
    ):
        raise ValueError("CLERK_ISSUER_URL must be a valid HTTPS origin")
    return f"https://{parsed.netloc}"


def validate_test_database_url(raw_url: str) -> URL:
    """Validate explicit test DB credentials before any test DB operation."""
    try:
        url = make_url(raw_url.strip())
    except Exception as exc:
        raise ValueError("TEST_DATABASE_URL is not a valid SQLAlchemy URL") from exc
    if url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}:
        raise ValueError("TEST_DATABASE_URL must use PostgreSQL")
    if not url.database or not url.database.endswith("_test"):
        raise ValueError("test database name must end in _test")
    production_url = os.getenv("DATABASE_URL")
    if production_url and normalize_database_url(raw_url) == normalize_database_url(production_url):
        raise ValueError("TEST_DATABASE_URL must be different from DATABASE_URL")
    if url.host not in {"localhost", "127.0.0.1", "::1"}:
        if os.getenv("ALLOW_REMOTE_TEST_DATABASE", "").lower() != "true":
            raise ValueError("remote test database requires ALLOW_REMOTE_TEST_DATABASE=true")
        if not production_url:
            raise ValueError("remote test database requires DATABASE_URL for isolation comparison")
        production = make_url(production_url)
        if url.host == production.host:
            raise ValueError("remote test database must use a separate host or branch")
    return url


@dataclass(frozen=True)
class Settings:
    database_url: str | None
    clerk_secret_key: str | None
    clerk_issuer_url: str | None
    clerk_webhook_signing_secret: str | None
    storage_public_base_url: str
    r2_account_id: str | None
    r2_access_key_id: str | None
    r2_secret_access_key: str | None
    r2_bucket_name: str | None
    allowed_origins: tuple[str, ...]
    migration_database_url: str | None = None
    database_listen_url: str | None = None
    landing_snapshot_enabled: bool = False
    rate_limit_redis_url: str | None = None
    environment: str = "development"
    render_runtime: bool = False
    api_docs_enabled: bool = True

    @property
    def requires_shared_rate_limit_store(self) -> bool:
        return self.render_runtime or self.environment == "production"

    @property
    def requires_migration_database_url(self) -> bool:
        return self.render_runtime or self.environment == "production"


def resolve_environment() -> tuple[str, bool]:
    """Validate APP_ENV and default Render deployments to production mode."""
    render_runtime = os.getenv("RENDER", "").strip().lower() == "true"
    raw_environment = os.getenv("APP_ENV")
    environment = raw_environment.strip().lower() if raw_environment else None
    if environment is not None and environment not in {"development", "staging", "production"}:
        raise ValueError("APP_ENV must be development, staging, or production")
    if environment is None:
        environment = "production" if render_runtime else "development"
    return environment, render_runtime


def resolve_api_docs_enabled(environment: str) -> bool:
    """Default interactive docs to local development, with an explicit override."""
    raw_value = os.getenv("API_DOCS_ENABLED")
    if raw_value is None:
        return environment == "development"
    normalized = raw_value.strip().lower()
    if normalized in {"true", "1", "yes", "on"}:
        return True
    if normalized in {"false", "0", "no", "off"}:
        return False
    raise ValueError("API_DOCS_ENABLED must be a boolean value")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    environment, render_runtime = resolve_environment()
    origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5174,http://127.0.0.1:5174",
    )
    return Settings(
        database_url=os.getenv("DATABASE_URL") or None,
        migration_database_url=os.getenv("MIGRATION_DATABASE_URL") or None,
        clerk_secret_key=os.getenv("CLERK_SECRET_KEY") or None,
        clerk_issuer_url=(os.getenv("CLERK_ISSUER_URL") or "").strip().rstrip("/") or None,
        clerk_webhook_signing_secret=os.getenv("CLERK_WEBHOOK_SIGNING_SECRET") or None,
        storage_public_base_url=os.getenv("STORAGE_PUBLIC_BASE_URL", "").rstrip("/"),
        r2_account_id=os.getenv("R2_ACCOUNT_ID") or None,
        r2_access_key_id=os.getenv("R2_ACCESS_KEY_ID") or None,
        r2_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY") or None,
        r2_bucket_name=os.getenv("R2_BUCKET_NAME") or None,
        allowed_origins=tuple(origin.strip() for origin in origins.split(",") if origin.strip()),
        database_listen_url=os.getenv("DATABASE_LISTEN_URL") or None,
        landing_snapshot_enabled=os.getenv("LANDING_SNAPSHOT_ENABLED", "").strip().lower() == "true",
        rate_limit_redis_url=os.getenv("RATE_LIMIT_REDIS_URL") or None,
        environment=environment,
        render_runtime=render_runtime,
        api_docs_enabled=resolve_api_docs_enabled(environment),
    )


def get_database_url() -> str:
    raw_url = get_settings().database_url
    if not raw_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return normalize_database_url(raw_url)


def get_migration_database_url() -> str:
    """Return Alembic's owner credential, never the runtime role on production."""
    settings = get_settings()
    raw_url = settings.migration_database_url
    if not raw_url:
        if settings.requires_migration_database_url:
            raise RuntimeError("MIGRATION_DATABASE_URL is required in production and on Render")
        return get_database_url()

    normalized = normalize_database_url(raw_url, variable_name="MIGRATION_DATABASE_URL")
    if settings.requires_migration_database_url and settings.database_url:
        try:
            migration_role = make_url(raw_url).username
            runtime_role = make_url(settings.database_url).username
        except Exception as exc:
            raise ValueError("Database URLs are not valid SQLAlchemy URLs") from exc
        if migration_role == runtime_role:
            raise RuntimeError(
                "MIGRATION_DATABASE_URL must use a separate database role in production"
            )
    migration_host = make_url(raw_url).host
    if settings.requires_migration_database_url and migration_host and "-pooler." in migration_host:
        raise RuntimeError("MIGRATION_DATABASE_URL must use a direct, non-pooled endpoint")
    return normalized
