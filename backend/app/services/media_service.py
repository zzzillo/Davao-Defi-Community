"""Image validation and ownership rules for private and shared media."""

from __future__ import annotations

import io
import warnings
from dataclasses import dataclass
from uuid import UUID

from PIL import Image, ImageFile, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import Role, parse_role
from app.models.media_asset import MediaAsset, MediaPurpose
from app.models.user import User
from app.services.storage_service import is_safe_object_key

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
SUPPORTED_CONTENT_TYPES = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}
OUTPUT_FORMATS = {"JPEG": ("jpg", "image/jpeg"), "PNG": ("png", "image/png"), "WEBP": ("webp", "image/webp")}
PRIVATE_PURPOSES = frozenset({MediaPurpose.PROFILE_PHOTO, MediaPurpose.BLOG_COVER})
SHARED_PURPOSES = frozenset(
    {MediaPurpose.EVENT_BANNER, MediaPurpose.RECAP_IMAGE, MediaPurpose.PARTNER_LOGO}
)


class InvalidImageError(ValueError):
    """The request does not contain one supported, bounded raster image."""


class MediaReferenceError(ValueError):
    """A content or profile mutation references an unavailable media asset."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class MediaAccessError(PermissionError):
    """The current role cannot upload for the requested media scope."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class NormalizedImage:
    content: bytes
    content_type: str
    image_format: str
    width: int
    height: int


def normalize_image(
    content: bytes,
    *,
    declared_content_type: str,
    max_input_bytes: int = MAX_UPLOAD_BYTES,
    max_output_bytes: int = MAX_UPLOAD_BYTES,
    max_pixels: int = MAX_IMAGE_PIXELS,
) -> NormalizedImage:
    """Decode, orient, strip metadata, and re-encode one supported raster.

    Both the upload size and the decoded dimensions are checked before pixel
    data is loaded. A fresh image made from pixels is saved without carrying
    the source metadata dictionary forward.
    """
    if len(content) > max_input_bytes:
        raise InvalidImageError("image_too_large")
    declared_type = declared_content_type.partition(";")[0].strip().lower()
    if declared_type not in SUPPORTED_CONTENT_TYPES.values():
        raise InvalidImageError("unsupported_image_type")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as probe:
                image_format = (probe.format or "").upper()
                if image_format not in SUPPORTED_CONTENT_TYPES:
                    raise InvalidImageError("unsupported_image_type")
                if SUPPORTED_CONTENT_TYPES[image_format] != declared_type:
                    raise InvalidImageError("image_content_type_mismatch")
                width, height = probe.size
                if width <= 0 or height <= 0 or width * height > max_pixels:
                    raise InvalidImageError("image_pixel_limit_exceeded")
                if getattr(probe, "is_animated", False) or getattr(probe, "n_frames", 1) != 1:
                    raise InvalidImageError("animated_images_not_supported")
                probe.verify()

            with Image.open(io.BytesIO(content)) as source:
                # Pillow's verify() invalidates the original decoder, so this
                # separate open checks the full pixel stream for truncation.
                if getattr(source, "is_animated", False) or getattr(source, "n_frames", 1) != 1:
                    raise InvalidImageError("animated_images_not_supported")
                source.load()
                oriented = ImageOps.exif_transpose(source)
                width, height = oriented.size
                if width * height > max_pixels:
                    raise InvalidImageError("image_pixel_limit_exceeded")

                has_alpha = "A" in oriented.getbands() or oriented.has_transparency_data
                output_mode = (
                    "RGBA"
                    if image_format in {"PNG", "WEBP"} and has_alpha
                    else "RGB"
                )
                clean_image = Image.frombytes(
                    output_mode,
                    oriented.size,
                    oriented.convert(output_mode).tobytes(),
                )
                output = io.BytesIO()
                if image_format == "JPEG":
                    clean_image.save(output, format="JPEG", quality=88, optimize=True)
                elif image_format == "PNG":
                    clean_image.save(output, format="PNG", optimize=True)
                else:
                    clean_image.save(output, format="WEBP", quality=88, method=6)
                encoded = output.getvalue()
    except InvalidImageError:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise InvalidImageError("invalid_or_truncated_image") from exc

    if len(encoded) > max_output_bytes:
        raise InvalidImageError("normalized_image_too_large")
    extension, output_type = OUTPUT_FORMATS[image_format]
    return NormalizedImage(
        content=encoded,
        content_type=output_type,
        image_format=extension,
        width=width,
        height=height,
    )


def validate_asset_scope(
    asset: MediaAsset,
    *,
    purpose: MediaPurpose | str,
    owner_id: UUID | None,
) -> None:
    """Require a registered VALID asset of the exact purpose and private owner."""
    purpose_value = MediaPurpose(purpose).value
    if asset.validation_status != "valid":
        raise MediaReferenceError("media_asset_not_valid")
    if asset.purpose != purpose_value:
        raise MediaReferenceError("media_asset_purpose_mismatch")
    if purpose_value in {item.value for item in PRIVATE_PURPOSES}:
        metadata = asset.metadata_json if isinstance(asset.metadata_json, dict) else {}
        if owner_id is None or metadata.get("scope_owner_id") != str(owner_id):
            raise MediaReferenceError("media_asset_scope_mismatch")


async def validate_media_reference(
    db: AsyncSession,
    key: str | None,
    *,
    purpose: MediaPurpose | str,
    owner_id: UUID | None,
    allow_external_url: bool = False,
) -> MediaAsset | None:
    """Require a newly attached object key to be a registered valid asset."""
    if key is None:
        return None
    if allow_external_url and is_allowed_external_url(key):
        return None
    if not is_safe_object_key(key):
        raise MediaReferenceError("invalid_media_reference")

    asset = await db.scalar(select(MediaAsset).where(MediaAsset.storage_key == key))
    if asset is None:
        raise MediaReferenceError("media_asset_not_found")
    validate_asset_scope(asset, purpose=purpose, owner_id=owner_id)
    return asset


def is_allowed_external_url(value: str) -> bool:
    """Keep the established Event banner URL behavior limited to HTTP(S)."""
    from urllib.parse import urlsplit

    try:
        parsed = urlsplit(value)
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


async def resolve_upload_scope(
    db: AsyncSession,
    actor: User,
    *,
    purpose: MediaPurpose,
    owner_user_id: UUID | None,
) -> UUID | None:
    """Authorize the private owner or role of a shared upload purpose."""
    actor_role = parse_role(actor.role)
    if purpose in SHARED_PURPOSES:
        if owner_user_id is not None:
            raise MediaAccessError("shared_media_has_no_user_owner")
        if actor_role not in {Role.OFFICIAL, Role.ADMIN, Role.SUPERADMIN}:
            raise MediaAccessError("shared_media_upload_requires_official")
        return None

    if purpose not in PRIVATE_PURPOSES:
        raise MediaAccessError("unsupported_media_purpose")

    target_id = owner_user_id or actor.id
    if target_id == actor.id:
        return actor.id
    if purpose is MediaPurpose.BLOG_COVER and actor_role is not Role.SUPERADMIN:
        raise MediaAccessError("blog_media_owner_required")
    if purpose is MediaPurpose.PROFILE_PHOTO and actor_role not in {
        Role.ADMIN,
        Role.SUPERADMIN,
    }:
        raise MediaAccessError("profile_media_owner_required")

    target = await db.scalar(
        select(User)
        .where(User.id == target_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if target is None:
        raise MediaAccessError("media_owner_not_found")
    target_role = parse_role(target.role)
    if actor_role is Role.ADMIN and target_role not in {
        Role.MEMBER,
        Role.OFFICIAL,
        Role.ADMIN,
    }:
        raise MediaAccessError("target_role_restricted")
    return target.id

