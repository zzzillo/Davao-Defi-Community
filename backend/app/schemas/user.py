import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.auth.permissions import Role
from app.models.user import AccountStatus
from app.schemas.common import validate_storage_key
from app.schemas.pagination import Page
from app.services.storage_service import resolve_public_url


class UserResponse(BaseModel):
    """Application user data for the authenticated user and admin surface."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clerk_user_id: str
    first_name: str | None
    last_name: str | None
    display_name: str
    bio: str | None
    email: str | None
    role: str
    status: str
    alias: str | None
    public_slug: str | None
    profile_photo_key: str | None
    positions: list[str]
    contributions: list[str]
    social_links: dict[str, str]
    show_in_contributor_directory: bool
    contributor_directory_order: int | None
    team_id: UUID | None

    @computed_field
    @property
    def profile_photo_url(self) -> str | None:
        """Resolve a stored profile key for authenticated profile editors."""
        return resolve_public_url(self.profile_photo_key)


class UserListResponse(BaseModel):
    """A page of users plus the matching total."""

    items: list[UserResponse]
    total: int
    directory_order_count: int = 0


class UserRoleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Role


class UserStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: AccountStatus


def _validate_public_slug(value: str | None) -> str | None:
    if value is not None and not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise ValueError("must use lowercase letters, numbers, and single hyphens")
    return value


class UserProfileUpdate(BaseModel):
    """Fields an account can edit on its own public profile."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    bio: str | None = Field(default=None, max_length=4000)
    alias: str | None = Field(default=None, max_length=80)
    public_slug: str | None = Field(default=None, max_length=120)
    contributions: list[str] | None = Field(default=None, max_length=50)
    social_links: dict[str, str] | None = None
    profile_photo_key: str | None = Field(default=None, max_length=500)

    @field_validator("public_slug")
    @classmethod
    def slug_format(cls, value: str | None) -> str | None:
        return _validate_public_slug(value)

    @field_validator("profile_photo_key")
    @classmethod
    def profile_photo_is_a_storage_key(cls, value: str | None) -> str | None:
        return validate_storage_key(value, example="media/profile_photo/<user_id>/<asset_id>.webp")

    @field_validator("social_links")
    @classmethod
    def valid_social_links(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return value
        if len(value) > 12:
            raise ValueError("at most 12 social links may be saved")
        if any(len(key) > 40 or len(url) > 2048 for key, url in value.items()):
            raise ValueError("social link names and URLs are too long")
        if any(not url.startswith(("https://", "http://")) for url in value.values()):
            raise ValueError("social links must use http or https URLs")
        return value

    @field_validator("contributions")
    @classmethod
    def valid_contributions(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and any(not item.strip() or len(item) > 300 for item in value):
            raise ValueError("contributions must be non-empty and at most 300 characters")
        return value

    @model_validator(mode="after")
    def non_nullable_fields_cannot_be_cleared_with_null(self):
        for field in ("display_name", "contributions", "social_links"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null; use an empty value to clear it")
        return self


class UserDirectoryUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    positions: list[str] = Field(default_factory=list, max_length=2)
    show_in_contributor_directory: bool
    contributor_directory_order: int | None = Field(default=None, ge=1)

    @field_validator("positions")
    @classmethod
    def unique_positions(cls, value: list[str]) -> list[str]:
        if any(not position or len(position) > 80 for position in value):
            raise ValueError("positions must be non-empty and at most 80 characters")
        if len(set(value)) != len(value):
            raise ValueError("positions must be unique")
        return value


class AdminUserProfileAndDirectoryUpdate(UserProfileUpdate):
    """Profile and public-directory fields saved together by an administrator."""

    positions: list[str] = Field(default_factory=list, max_length=2)
    show_in_contributor_directory: bool
    contributor_directory_order: int | None = Field(default=None, ge=1)

    @field_validator("positions")
    @classmethod
    def unique_positions(cls, value: list[str]) -> list[str]:
        if any(not position or len(position) > 80 for position in value):
            raise ValueError("positions must be non-empty and at most 80 characters")
        if len(set(value)) != len(value):
            raise ValueError("positions must be unique")
        return value


class InvitationProfileDetails(BaseModel):
    """Optional app-owned profile values applied after invite acceptance."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    bio: str | None = Field(default=None, max_length=4000)
    alias: str | None = Field(default=None, max_length=80)
    positions: list[str] | None = Field(default=None, max_length=2)
    contributions: list[str] | None = Field(default=None, max_length=50)
    social_links: dict[str, str] | None = None

    @field_validator("positions")
    @classmethod
    def valid_positions(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        if any(not item.strip() or len(item) > 80 for item in value) or len(set(value)) != len(value):
            raise ValueError("positions must be unique, non-empty, and at most 80 characters")
        return value

    @field_validator("contributions")
    @classmethod
    def valid_contributions(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and any(not item.strip() or len(item) > 300 for item in value):
            raise ValueError("contributions must be non-empty and at most 300 characters")
        return value

    @field_validator("social_links")
    @classmethod
    def valid_social_links(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return value
        if len(value) > 12 or any(len(key) > 40 or len(url) > 2048 for key, url in value.items()):
            raise ValueError("social link names or URLs are too long")
        if any(not url.startswith(("https://", "http://")) for url in value.values()):
            raise ValueError("social links must use http or https URLs")
        return value

    @model_validator(mode="after")
    def reject_null_for_non_nullable_fields(self):
        for field in ("positions", "contributions", "social_links"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null; use an empty value to clear it")
        return self


class InvitationCreate(BaseModel):
    """An app invitation. Access scope comes from the authenticated caller."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: str = Field(min_length=3, max_length=320)
    role: Role = Role.MEMBER
    profile_details: InvitationProfileDetails | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("must be a valid email address")
        return normalized


class InvitationResponse(BaseModel):
    """Safe application-facing invitation lifecycle fields."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    assigned_role: str
    status: str
    created_at: datetime
    expires_at: datetime | None
    accepted_at: datetime | None
    failed_at: datetime | None
    delivery_attempts: int


class InvitationListResponse(BaseModel):
    items: list[InvitationResponse]
    total: int


class ContributorResponse(BaseModel):
    """Public fields for the contributor directory and profile page."""

    model_config = ConfigDict(from_attributes=True)

    display_name: str
    public_slug: str
    alias: str | None
    bio: str | None
    profile_photo_key: str | None
    positions: list[str]
    contributions: list[str]
    social_links: dict[str, str]

    @computed_field
    @property
    def profile_photo_url(self) -> str | None:
        return resolve_public_url(self.profile_photo_key)


ContributorListResponse = Page[ContributorResponse]
