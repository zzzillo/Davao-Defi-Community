"""Authenticated, bounded uploads for validated community images."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.auth.dependencies import get_current_db_user
from app.auth.locks import USER_MUTATION_LOCK_KEY
from app.database import get_db
from app.models.activity_log import ActivityAction, ActivityAudience, ActivityResource
from app.models.media_asset import MediaAsset, MediaPurpose, MediaValidationStatus
from app.models.user import AccountStatus, User
from app.schemas.media import MediaUploadResponse
from app.services import activity_log_service, storage_service
from app.services.media_service import (
    MAX_UPLOAD_BYTES,
    InvalidImageError,
    MediaAccessError,
    normalize_image,
    resolve_upload_scope,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/media", tags=["Media"])


async def _read_bounded_body(request: Request) -> bytes:
    """Read a raw request body without trusting Content-Length or a parser."""
    content_length = request.headers.get("content-length")
    if content_length is not None:
        if not content_length.isdecimal():
            raise HTTPException(status_code=400, detail={"reason": "invalid_content_length"})
        if int(content_length) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail={"reason": "upload_too_large"})

    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail={"reason": "upload_too_large"})
        chunks.append(chunk)
    if not size:
        raise HTTPException(status_code=422, detail={"reason": "empty_image"})
    return b"".join(chunks)


def _service_unavailable(reason: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"reason": reason},
    )


async def _rollback_quietly(db: AsyncSession) -> None:
    """Release a failed transaction without forwarding database error text."""
    try:
        await db.rollback()
    except Exception:
        logger.warning("Media transaction rollback failed")


@router.post(
    "/uploads",
    response_model=MediaUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_media(
    request: Request,
    response: Response,
    purpose: MediaPurpose,
    owner_user_id: UUID | None = None,
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Validate and normalize one raw raster body before storing it.

    Profile and blog assets are private to their scoped user, though a
    permitted administrator can upload a profile image for an exact target.
    Event, recap, and partner images are shared among official-tier writers.
    """
    actor_id = actor.id
    try:
        scope_owner_id = await resolve_upload_scope(
            db,
            actor,
            purpose=purpose,
            owner_user_id=owner_user_id,
        )
    except MediaAccessError as exc:
        status_code = 404 if exc.reason == "media_owner_not_found" else 403
        raise HTTPException(status_code=status_code, detail={"reason": exc.reason}) from exc
    # The first scope check avoids receiving a large body from a caller who is
    # not allowed. Release its read-only transaction before waiting for bytes.
    await _rollback_quietly(db)

    try:
        storage_service.validate_storage_settings()
    except storage_service.StorageConfigurationError as exc:
        raise _service_unavailable("media_storage_not_configured") from exc

    body = await _read_bounded_body(request)
    declared_type = request.headers.get("content-type", "")
    try:
        normalized = await run_in_threadpool(
            normalize_image,
            body,
            declared_content_type=declared_type,
        )
    except InvalidImageError as exc:
        code = 413 if exc.args and exc.args[0] in {
            "image_too_large",
            "normalized_image_too_large",
        } else 415 if exc.args and exc.args[0] == "unsupported_image_type" else 422
        raise HTTPException(status_code=code, detail={"reason": exc.args[0]}) from exc

    # Role changes, suspension, and media writes share Stage 2's advisory lock.
    # Take it only after the client body and image work are complete, then hold
    # it across R2 and the audit transaction so a stale role cannot publish an
    # upload after a concurrent demotion.
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:lock_key)"),
        {"lock_key": USER_MUTATION_LOCK_KEY},
    )
    current_actor = await db.scalar(
        select(User)
        .where(User.id == actor_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if (
        current_actor is None
        or current_actor.status != AccountStatus.ACTIVE.value
        or current_actor.clerk_deleted_at is not None
    ):
        await _rollback_quietly(db)
        raise HTTPException(status_code=403, detail={"reason": "inactive_actor"})
    actor = current_actor
    try:
        scope_owner_id = await resolve_upload_scope(
            db,
            actor,
            purpose=purpose,
            owner_user_id=owner_user_id,
        )
    except MediaAccessError as exc:
        await _rollback_quietly(db)
        status_code = 404 if exc.reason == "media_owner_not_found" else 403
        raise HTTPException(status_code=status_code, detail={"reason": exc.reason}) from exc

    asset_id = uuid4()
    key = f"media/{purpose.value}/{actor.id}/{asset_id}.{normalized.image_format}"
    try:
        await run_in_threadpool(
            storage_service.put_object,
            key,
            normalized.content,
            normalized.content_type,
        )
    except storage_service.StorageConfigurationError as exc:
        raise _service_unavailable("media_storage_not_configured") from exc
    except storage_service.StorageProviderError as exc:
        # PutObject may have reached R2 before a network timeout was returned.
        await run_in_threadpool(storage_service.delete_object, key)
        raise _service_unavailable("media_storage_unavailable") from exc

    public_url = storage_service.resolve_public_url(key)
    if public_url is None:
        await run_in_threadpool(storage_service.delete_object, key)
        raise _service_unavailable("media_public_url_not_configured")

    metadata: dict[str, object] = {
        "format": normalized.image_format,
        "content_type": normalized.content_type,
        "bytes": len(normalized.content),
        "width": normalized.width,
        "height": normalized.height,
    }
    if scope_owner_id is not None:
        metadata["scope_owner_id"] = str(scope_owner_id)
    asset = MediaAsset(
        id=asset_id,
        storage_key=key,
        uploaded_by_user_id=actor.id,
        purpose=purpose.value,
        validation_status=MediaValidationStatus.VALID.value,
        metadata_json=metadata,
        validated_at=datetime.now(timezone.utc),
    )

    db.add(asset)
    try:
        await db.flush()
        await activity_log_service.log_activity(
            db,
            user_id=actor.id,
            owner_id=scope_owner_id or actor.id,
            audience=(
                ActivityAudience.PRIVATE
                if scope_owner_id is not None
                else ActivityAudience.SHARED
            ),
            action=ActivityAction.CREATED,
            resource=ActivityResource.MEDIA,
            resource_id=asset.id,
            details={
                "purpose": purpose.value,
                "content_type": normalized.content_type,
                "byte_size": len(normalized.content),
                "width": normalized.width,
                "height": normalized.height,
            },
        )
    except Exception as exc:
        await _rollback_quietly(db)
        await run_in_threadpool(storage_service.delete_object, key)
        logger.warning("Media metadata transaction failed; uploaded object cleanup was attempted")
        raise _service_unavailable("media_registration_failed") from exc

    try:
        await db.commit()
    except Exception as exc:
        # A lost commit acknowledgement is ambiguous: the row and audit entry
        # may already be durable. Retain the object rather than risk breaking
        # a committed database reference; an operator can reconcile an orphan
        # if the transaction did not commit.
        await _rollback_quietly(db)
        logger.warning("Media commit outcome is uncertain; uploaded object was retained")
        raise _service_unavailable("media_commit_uncertain") from exc

    response.headers["Cache-Control"] = "no-store"
    return MediaUploadResponse(
        id=asset.id,
        storage_key=asset.storage_key,
        purpose=purpose,
        public_url=public_url,
        content_type=normalized.content_type,
        byte_size=len(normalized.content),
        width=normalized.width,
        height=normalized.height,
        validation_status=MediaValidationStatus.VALID,
    )
