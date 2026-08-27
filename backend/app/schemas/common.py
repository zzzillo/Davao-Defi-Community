"""Schemas shared by more than one module.

A file that earns its place the moment a second module needs the same shape.
Posts wanted exactly what Events already had for showing an author, and two
copies of that would be two places to get it wrong.
"""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PublicUserResponse(BaseModel):
    """The slice of a user that is safe to show to anybody.

    Not UserResponse, and never UserResponse. The endpoints that embed this are
    public: UserResponse carries clerk_user_id, role, and permissions, so
    including it would publish a list of who your officials are and exactly
    what each of them can do, to anyone who loads a page.

    A display name and an id are all a byline needs.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str


def validate_storage_key(value: str | None, *, example: str) -> str | None:
    """Refuse anything that looks like a URL where a storage key belongs.

    The entire storage design rests on rows holding keys, so that the domain
    serving them stays configuration. One bucket URL written into a row is a
    row that breaks the day the bucket moves - and it will not announce itself,
    it will just quietly serve a dead image.

    Written for post images, and moved here the moment blog covers needed the
    same rule. Meant to be used as the body of a field_validator:

        @field_validator("cover_image_key")
        @classmethod
        def key_not_url(cls, value):
            return validate_storage_key(value, example="blogs/<blog_id>/cover.jpg")

    `example` is required rather than defaulted, so the message names the shape
    the caller actually wants. A shared validator with one hardcoded example
    tells a post author about blog covers.

    Deliberately NOT applied to Event.banner_image_key. resolve_public_url
    accepts an absolute URL on purpose - it is how an externally hosted poster
    works, and how images worked at all before R2 - and events have been
    relying on that. Tightening it is a separate decision with a migration
    attached, not a side effect of adding blogs.
    """
    if value is not None and value.startswith(("http://", "https://", "//")):
        raise ValueError(f"must be a storage key such as {example}, not a URL")

    return value
