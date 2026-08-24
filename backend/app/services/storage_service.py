"""Where uploaded files live, and how a stored reference becomes a public URL.

Every module that stores an image talks to this module and never to a storage
provider directly. Today there is no provider at all; tomorrow it is Cloudflare
R2. Nothing outside this file should be able to tell the difference, which is
the whole point of it existing before R2 does.

Only the read side is here. Uploading - presigned URLs, content-type checks,
size limits - arrives with the upload endpoint, and lands in this same file.
"""

import logging
import os
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_public_base_url() -> str:
    """The origin the bucket is served from, without a trailing slash.

    Read on first call rather than at import, matching clerk_service, so a
    script can load its .env before anything reads the environment.

    Empty is a valid answer: before R2 exists there is nowhere to serve keys
    from, and the application still has to start.
    """
    return os.getenv("STORAGE_PUBLIC_BASE_URL", "").rstrip("/")


def resolve_public_url(reference: str | None) -> str | None:
    """Turn a stored reference into something a browser can load.

    Two shapes are accepted on purpose:

    - an object key, "events/<id>/banner.jpg", which is what an R2 upload will
      produce and what we want in the database long term
    - an absolute URL, which is how images work before R2 is configured, and
      how an externally hosted poster keeps working afterwards

    Returns None rather than a placeholder path, so what an image-less event
    looks like stays a frontend decision.
    """
    if not reference:
        return None

    if reference.startswith(("http://", "https://")):
        return reference

    base = get_public_base_url()

    if not base:
        # A key with nowhere to serve it from. Rendering nothing beats
        # rendering a broken image, and the log says exactly what is missing.
        logger.warning(
            "STORAGE_PUBLIC_BASE_URL is unset, cannot build a URL for %s",
            reference,
        )
        return None

    return f"{base}/{reference.lstrip('/')}"
