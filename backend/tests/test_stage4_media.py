"""Offline Stage 4 image validation, URL, and storage configuration checks."""

from __future__ import annotations

import io
import struct
import unittest
import zlib
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from PIL import Image


class ImageNormalizationTests(unittest.TestCase):
    def _image_bytes(self, fmt: str, *, size=(12, 8), mode="RGB", **save_options) -> bytes:
        image = Image.new(mode, size, (30, 80, 120) if mode == "RGB" else (30, 80, 120, 160))
        output = io.BytesIO()
        image.save(output, format=fmt, **save_options)
        return output.getvalue()

    def test_normalizes_supported_rasters_and_returns_actual_dimensions(self) -> None:
        from app.services.media_service import normalize_image

        for fmt, content_type in (
            ("JPEG", "image/jpeg"),
            ("PNG", "image/png"),
            ("WEBP", "image/webp"),
        ):
            with self.subTest(fmt=fmt):
                result = normalize_image(
                    self._image_bytes(fmt), declared_content_type=content_type
                )
                self.assertEqual(result.content_type, content_type)
                self.assertEqual((result.width, result.height), (12, 8))
                self.assertLessEqual(len(result.content), 10 * 1024 * 1024)
                with Image.open(io.BytesIO(result.content)) as normalized:
                    self.assertEqual(normalized.format, fmt)
                    self.assertFalse(
                        {"exif", "xmp", "icc_profile"}.intersection(normalized.info)
                    )

    def test_applies_exif_orientation_before_discarding_metadata(self) -> None:
        from app.services.media_service import normalize_image

        exif = Image.Exif()
        exif[274] = 6
        content = self._image_bytes("JPEG", size=(16, 8), exif=exif)
        result = normalize_image(content, declared_content_type="image/jpeg")
        self.assertEqual((result.width, result.height), (8, 16))
        with Image.open(io.BytesIO(result.content)) as normalized:
            self.assertNotIn("exif", normalized.info)

    def test_rejects_mime_spoofing_truncation_animation_and_svg(self) -> None:
        from app.services.media_service import InvalidImageError, normalize_image

        jpeg = self._image_bytes("JPEG")
        animated = io.BytesIO()
        Image.new("RGB", (8, 8), "red").save(
            animated,
            format="WEBP",
            save_all=True,
            append_images=[Image.new("RGB", (8, 8), "blue")],
            duration=50,
            loop=0,
        )
        samples = (
            (jpeg, "image/png"),
            (jpeg[: len(jpeg) // 2], "image/jpeg"),
            (animated.getvalue(), "image/webp"),
            (b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", "image/svg+xml"),
        )
        for content, content_type in samples:
            with self.subTest(content_type=content_type, size=len(content)):
                with self.assertRaises(InvalidImageError):
                    normalize_image(content, declared_content_type=content_type)

    def test_rejects_images_above_pixel_limit(self) -> None:
        from app.services.media_service import InvalidImageError, normalize_image

        small = self._image_bytes("PNG")
        oversized = bytearray(small)
        struct.pack_into(">II", oversized, 16, 5000, 5000)
        oversized[29:33] = struct.pack(">I", zlib.crc32(oversized[12:29]) & 0xFFFFFFFF)
        with self.assertRaises(InvalidImageError):
            normalize_image(bytes(oversized), declared_content_type="image/png")

    def test_rejects_oversized_normalized_output(self) -> None:
        from app.services.media_service import InvalidImageError, normalize_image

        with self.assertRaises(InvalidImageError):
            normalize_image(
                self._image_bytes("PNG", size=(12, 8)),
                declared_content_type="image/png",
                max_output_bytes=8,
            )


class StorageConfigurationAndReferenceTests(unittest.TestCase):
    def test_public_base_url_must_be_a_https_origin_with_safe_path_prefix(self) -> None:
        from app.services.storage_service import validate_public_base_url

        self.assertEqual(
            validate_public_base_url("https://cdn.example.test/community/media/"),
            "https://cdn.example.test/community/media",
        )
        for value in (
            "http://cdn.example.test",
            "file:///tmp/images",
            "javascript:alert(1)",
            "https://user:pass@cdn.example.test",
            "https://cdn.example.test/a/../private",
            "https://cdn.example.test?download=1",
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_public_base_url(value)

    def test_public_url_resolver_joins_only_safe_keys_and_keeps_http_event_urls(self) -> None:
        from app.services.storage_service import resolve_public_url

        with patch(
            "app.services.storage_service.get_public_base_url",
            return_value="https://cdn.example.test/community",
        ):
            self.assertEqual(
                resolve_public_url("media/blog_cover/owner/asset.webp"),
                "https://cdn.example.test/community/media/blog_cover/owner/asset.webp",
            )
            self.assertEqual(
                resolve_public_url("https://legacy.example.test/poster.jpg"),
                "https://legacy.example.test/poster.jpg",
            )
            for value in ("../secret", "/absolute/path", "media/%2e%2e/private", "data:image/png;base64,AA"):
                with self.subTest(value=value):
                    self.assertIsNone(resolve_public_url(value))

    def test_r2_client_is_lazy_and_uses_cloudflare_endpoint_and_checksum_compatibility(self) -> None:
        from app.config import Settings
        from app.services import storage_service

        config = Settings(
            database_url=None,
            clerk_secret_key=None,
            clerk_issuer_url=None,
            clerk_webhook_signing_secret=None,
            storage_public_base_url="https://cdn.example.test",
            r2_account_id="a1" * 16,
            r2_access_key_id="access-placeholder",
            r2_secret_access_key="secret-placeholder",
            r2_bucket_name="media-test",
            allowed_origins=(),
        )
        with (
            patch.object(storage_service, "get_settings", return_value=config),
            patch("boto3.client") as client_factory,
        ):
            storage_service._make_r2_client.cache_clear()
            storage_service.get_r2_client()

        kwargs = client_factory.call_args.kwargs
        self.assertEqual(kwargs["service_name"], "s3")
        self.assertEqual(
            kwargs["endpoint_url"],
            f"https://{'a1' * 16}.r2.cloudflarestorage.com",
        )
        self.assertEqual(kwargs["region_name"], "auto")
        self.assertEqual(kwargs["aws_access_key_id"], "access-placeholder")
        self.assertEqual(kwargs["aws_secret_access_key"], "secret-placeholder")
        self.assertEqual(kwargs["config"].request_checksum_calculation, "when_required")
        self.assertEqual(kwargs["config"].response_checksum_validation, "when_required")

    def test_missing_r2_or_public_url_configuration_has_generic_storage_error(self) -> None:
        from app.config import Settings
        from app.services.storage_service import StorageConfigurationError, validate_storage_settings

        empty = Settings(
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
        with self.assertRaises(StorageConfigurationError):
            validate_storage_settings(empty)

    def test_scoped_asset_requires_valid_status_purpose_and_owner(self) -> None:
        from app.services.media_service import MediaReferenceError, validate_asset_scope

        owner_id = uuid4()
        asset = SimpleNamespace(
            validation_status="valid",
            purpose="blog_cover",
            metadata_json={"scope_owner_id": str(owner_id)},
        )
        validate_asset_scope(asset, purpose="blog_cover", owner_id=owner_id)
        for invalid in (
            SimpleNamespace(validation_status="pending", purpose="blog_cover", metadata_json={"scope_owner_id": str(owner_id)}),
            SimpleNamespace(validation_status="valid", purpose="profile_photo", metadata_json={"scope_owner_id": str(owner_id)}),
            SimpleNamespace(validation_status="valid", purpose="blog_cover", metadata_json={"scope_owner_id": str(uuid4())}),
        ):
            with self.subTest(invalid=invalid), self.assertRaises(MediaReferenceError):
                validate_asset_scope(invalid, purpose="blog_cover", owner_id=owner_id)


if __name__ == "__main__":
    unittest.main()
