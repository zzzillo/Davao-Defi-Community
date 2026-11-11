from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MediaValidationStatus(StrEnum):
    PENDING = "pending"
    VALID = "valid"
    INVALID = "invalid"


class MediaPurpose(StrEnum):
    """The single content/profile use permitted for an uploaded image."""

    PROFILE_PHOTO = "profile_photo"
    BLOG_COVER = "blog_cover"
    EVENT_BANNER = "event_banner"
    RECAP_IMAGE = "recap_image"
    PARTNER_LOGO = "partner_logo"


class MediaAsset(Base):
    """A storage object reference with its validation and uploader metadata."""

    __tablename__ = "media_assets"
    __table_args__ = (
        CheckConstraint(
            "validation_status IN ('pending', 'valid', 'invalid')",
            name="ck_media_assets_validation_status",
        ),
        CheckConstraint("length(purpose) > 0", name="ck_media_assets_purpose_nonempty"),
        CheckConstraint("jsonb_typeof(metadata) = 'object'", name="ck_media_assets_metadata_object"),
        UniqueConstraint("key", name="uq_media_assets_key"),
        Index("ix_media_assets_uploader_created", "uploaded_by_user_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    storage_key: Mapped[str] = mapped_column("key", String(500), nullable=False)
    uploaded_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    purpose: Mapped[str] = mapped_column(String(50), nullable=False)
    validation_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=MediaValidationStatus.PENDING.value,
        server_default=MediaValidationStatus.PENDING.value,
    )
    metadata_json: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
