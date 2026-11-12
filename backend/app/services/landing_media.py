"""Generate and reuse CDN-sized images for the public landing cards."""

from __future__ import annotations

import io
import logging
from contextlib import closing
from functools import lru_cache
from hashlib import sha256

from botocore.exceptions import ClientError
from PIL import Image, ImageOps

from app.services import storage_service
from app.services.media_service import InvalidImageError, MAX_IMAGE_PIXELS, MAX_UPLOAD_BYTES

logger = logging.getLogger(__name__)
MAX_VARIANT_HEIGHT = 2048


def is_missing_object(error: ClientError) -> bool:
    return error.response.get("Error", {}).get("Code") in {"NoSuchKey", "NotFound", "404"}


class SnapshotMedia:
    def __init__(self, client, bucket: str) -> None:
        self.client = client
        self.bucket = bucket

    def image(self, reference: str | None, widths: tuple[int, ...]) -> dict | None:
        url = storage_service.resolve_public_url(reference)
        if not url or not url.startswith("https://"):
            return None
        if not storage_service.is_safe_object_key(reference):
            return {"src": url, "variants": []}
        try:
            variants = self._variants(reference, widths)
        except (FileNotFoundError, InvalidImageError):
            logger.warning("Landing card source image is missing or invalid")
            return None
        return {"src": variants[-1]["url"], "variants": variants}

    @lru_cache(maxsize=512)
    def _variants(self, reference: str, widths: tuple[int, ...]) -> list[dict]:
        # The uploader gives each source a unique key. Include the resize
        # recipe in the hash so a future recipe can publish new immutable URLs.
        digest = sha256(f"webp-v1:{reference}".encode()).hexdigest()
        variants = {}
        missing = []
        for width in widths:
            key = f"landing/v1/images/{digest}-{width}.webp"
            try:
                head = self.client.head_object(Bucket=self.bucket, Key=key)
            except ClientError as error:
                if not is_missing_object(error):
                    raise
                missing.append((width, key))
            else:
                actual_width = int(head["Metadata"]["width"])
                variants[actual_width] = key
                if actual_width < width:
                    break

        if missing:
            with self._read_source(reference) as image:
                for width, key in missing:
                    scale = min(1, width / image.width, MAX_VARIANT_HEIGHT / image.height)
                    actual_width = max(1, round(image.width * scale))
                    if actual_width in variants:
                        continue
                    height = max(1, round(image.height * scale))
                    with image.resize((actual_width, height), Image.Resampling.LANCZOS) as resized:
                        output = io.BytesIO()
                        resized.save(output, format="WEBP", quality=80, method=4)
                    try:
                        self.client.put_object(
                            Bucket=self.bucket, Key=key, Body=output.getvalue(),
                            ContentType="image/webp", CacheControl="public, max-age=31536000, immutable",
                            Metadata={"width": str(actual_width)}, IfNoneMatch="*",
                        )
                    except ClientError as error:
                        if error.response.get("Error", {}).get("Code") not in {"PreconditionFailed", "412"}:
                            raise
                    variants[actual_width] = key

        return [
            {"url": storage_service.resolve_public_url(key), "width": width}
            for width, key in sorted(variants.items())
        ]

    def _read_source(self, reference: str) -> Image.Image:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=reference)
        except ClientError as error:
            if is_missing_object(error):
                raise FileNotFoundError from error
            raise

        with closing(response["Body"]) as body:
            content = body.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            raise InvalidImageError("image_too_large")

        try:
            with Image.open(io.BytesIO(content), formats=("JPEG", "PNG", "WEBP")) as source:
                if source.width * source.height > MAX_IMAGE_PIXELS or getattr(source, "is_animated", False):
                    raise InvalidImageError("unsupported_landing_image")
                with ImageOps.exif_transpose(source) as oriented:
                    return oriented.convert("RGBA" if oriented.has_transparency_data else "RGB")
        except (OSError, ValueError, Image.DecompressionBombError) as error:
            raise InvalidImageError("invalid_landing_image") from error


@lru_cache(maxsize=4)
def snapshot_media(client, bucket: str) -> SnapshotMedia:
    return SnapshotMedia(client, bucket)
