"""Public response contract for a server-validated media upload."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.media_asset import MediaPurpose, MediaValidationStatus


class MediaUploadResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    storage_key: str
    purpose: MediaPurpose
    public_url: str
    content_type: str
    byte_size: int = Field(ge=1)
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    validation_status: MediaValidationStatus
