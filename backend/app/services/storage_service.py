"""Cloudflare R2 storage access and safe resolution of public image URLs."""

from __future__ import annotations

import logging
import re
from functools import lru_cache
from urllib.parse import unquote, urlsplit

import boto3
from botocore.config import Config

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)
_SAFE_KEY_SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
_SAFE_ACCOUNT_ID = re.compile(r"^[A-Za-z0-9-]{1,63}$")
_SAFE_BUCKET = re.compile(r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$")


class StorageConfigurationError(RuntimeError):
    """The image storage integration is absent or invalid."""


class StorageProviderError(RuntimeError):
    """A generic provider failure without upstream details or credentials."""


def validate_public_base_url(raw_url: str | None) -> str:
    """Accept only an HTTPS origin plus a safe, optional URL path prefix."""
    if not raw_url:
        raise ValueError("STORAGE_PUBLIC_BASE_URL must be configured")
    value = raw_url.strip().rstrip("/")
    try:
        parsed = urlsplit(value)
        _ = parsed.port
    except ValueError as exc:
        raise ValueError("STORAGE_PUBLIC_BASE_URL must be a valid HTTPS URL") from exc
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or any(ord(character) < 32 or character.isspace() for character in value)
    ):
        raise ValueError("STORAGE_PUBLIC_BASE_URL must be a valid HTTPS URL")

    path = unquote(parsed.path)
    if "\\" in path or any(segment in {".", ".."} for segment in path.split("/")):
        raise ValueError("STORAGE_PUBLIC_BASE_URL must not contain traversal paths")
    if any(not _SAFE_KEY_SEGMENT.fullmatch(segment) for segment in path.split("/") if segment):
        raise ValueError("STORAGE_PUBLIC_BASE_URL path contains unsupported characters")
    return value


@lru_cache(maxsize=1)
def get_public_base_url() -> str:
    """Read the static public domain lazily, as with the other integrations."""
    return get_settings().storage_public_base_url


def validate_storage_settings(settings: Settings | None = None) -> tuple[str, str]:
    """Validate the complete config required to publish an uploaded image."""
    settings = settings or get_settings()
    account_id = (settings.r2_account_id or "").strip()
    access_key = (settings.r2_access_key_id or "").strip()
    secret_key = (settings.r2_secret_access_key or "").strip()
    bucket = (settings.r2_bucket_name or "").strip()
    try:
        validate_public_base_url(settings.storage_public_base_url)
    except ValueError as exc:
        raise StorageConfigurationError("public_image_domain_not_configured") from exc

    if (
        not _SAFE_ACCOUNT_ID.fullmatch(account_id)
        or not access_key
        or not secret_key
        or not _SAFE_BUCKET.fullmatch(bucket)
        or ".." in bucket
        or ".-" in bucket
        or "-." in bucket
    ):
        raise StorageConfigurationError("r2_storage_not_configured")
    return account_id, bucket


@lru_cache(maxsize=4)
def _make_r2_client(account_id: str, access_key: str, secret_key: str):
    """Build a low-level client once per settings tuple, without network IO."""
    return boto3.client(
        service_name="s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        config=Config(
            connect_timeout=5,
            read_timeout=20,
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
            retries={"mode": "standard", "total_max_attempts": 3},
            s3={"addressing_style": "path"},
        ),
    )


def get_r2_client():
    """Return the cached R2 S3 client after validating all image settings."""
    settings = get_settings()
    account_id, _ = validate_storage_settings(settings)
    return _make_r2_client(
        account_id,
        (settings.r2_access_key_id or "").strip(),
        (settings.r2_secret_access_key or "").strip(),
    )


def get_r2_bucket() -> str:
    """Return the configured bucket after the same fail-closed validation."""
    _, bucket = validate_storage_settings()
    return bucket


def _is_safe_key(reference: str) -> bool:
    if not reference or reference.startswith("/") or "\\" in reference:
        return False
    if any(ord(character) < 32 or character.isspace() for character in reference):
        return False
    if any(character in reference for character in ("%", "?", "#", ":")):
        return False
    segments = reference.split("/")
    return all(
        segment not in {".", ".."} and _SAFE_KEY_SEGMENT.fullmatch(segment)
        for segment in segments
    )


def is_safe_object_key(reference: str) -> bool:
    """Public spelling used by media input validation and URL resolution."""
    return _is_safe_key(reference)


def _external_http_url(reference: str) -> bool:
    try:
        parsed = urlsplit(reference)
        _ = parsed.port
    except ValueError:
        return False
    return (
        parsed.scheme.lower() in {"http", "https"}
        and bool(parsed.netloc)
        and bool(parsed.hostname)
        and not parsed.username
        and not parsed.password
    )


def resolve_public_url(reference: str | None) -> str | None:
    """Resolve a safe object key or preserve a legacy HTTP(S) event image URL."""
    if not reference:
        return None
    if _external_http_url(reference):
        return reference
    if not _is_safe_key(reference):
        return None

    base = get_public_base_url()
    if not base:
        logger.warning("STORAGE_PUBLIC_BASE_URL is unset, image URL omitted")
        return None
    try:
        safe_base = validate_public_base_url(base)
    except ValueError:
        logger.warning("STORAGE_PUBLIC_BASE_URL is invalid, image URL omitted")
        return None
    return f"{safe_base}/{reference}"


def put_object(key: str, content: bytes, content_type: str) -> None:
    """Persist a normalized image with immutable caching and no ACL controls."""
    try:
        get_r2_client().put_object(
            Bucket=get_r2_bucket(),
            Key=key,
            Body=content,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
    except StorageConfigurationError:
        raise
    except Exception as exc:
        logger.warning("R2 object upload failed")
        raise StorageProviderError("storage_provider_unavailable") from exc


def delete_object(key: str) -> None:
    """Best-effort compensation for one key generated by the current request."""
    try:
        get_r2_client().delete_object(Bucket=get_r2_bucket(), Key=key)
    except Exception:
        logger.warning("R2 object cleanup failed")
