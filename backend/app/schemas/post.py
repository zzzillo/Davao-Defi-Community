from datetime import date, datetime, timedelta
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

from app.schemas.common import PublicUserResponse, validate_storage_key
from app.schemas.pagination import Page
from app.services.storage_service import resolve_public_url

# Kept beside the schemas so the numbers that must match app/models/post.py are
# visible in one place. The column is the hard limit; these produce a readable
# 422 before the database ever has to complain.
TITLE_MAX_LENGTH = 200
LOCATION_MAX_LENGTH = 300
IMAGE_KEY_MAX_LENGTH = 500

# No column cap on description - Text is unbounded - so this exists purely to
# stop somebody pasting a novel into a caption.
DESCRIPTION_MAX_LENGTH = 5000

# A gallery, not an archive. Thirty photographs is already a long scroll, and
# every one of them is a stored object somebody pays for.
MAX_IMAGES = 30

# Catches a mistyped year. Nothing this community did happened in 1899.
EARLIEST_POST_DATE = date(2000, 1, 1)

# A recap describes something that already happened, so a date in the future is
# almost always a typo - but "the future" depends on where you are standing.
#
# The server reads today in UTC. An official in Davao at 00:30 on the 16th is
# at 16:30 on the 15th in UTC, and sets post_date to the 16th because that is
# genuinely their today. One day of slack is the width of that gap.
FUTURE_DATE_SLACK = timedelta(days=1)


class PostImageInput(BaseModel):
    """One photograph on the way in.

    An object rather than a bare string, which looks like ceremony until the
    day an image needs alt text: going from ["a.jpg"] to [{"image_key": ...}]
    breaks every client, while adding a field to an object breaks none.

    Note what is absent: display_order. Position in the list is the order. If
    the client sent both, the two could disagree and nothing would say which
    one wins.
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    image_key: str = Field(min_length=1, max_length=IMAGE_KEY_MAX_LENGTH)

    @field_validator("image_key")
    @classmethod
    def must_be_a_key_not_a_url(cls, value: str) -> str:
        """See schemas/common.validate_storage_key - blogs need the same rule."""
        return validate_storage_key(value, example="posts/<post_id>/<image_id>.jpg")


class PostBase(BaseModel):
    """The rules shared by create and update. Deliberately declares no fields.

    Create requires a post_date; update must not, or every PATCH would have to
    resend the whole post. So the two shapes differ, and what they share is the
    validation. check_fields=False tells Pydantic the named fields arrive in
    the subclasses rather than here.
    """

    model_config = ConfigDict(
        # Turns "  Recap  " into "Recap" before any length check runs, so a
        # title of pure whitespace fails instead of sneaking through.
        str_strip_whitespace=True,
        # Reject unknown keys rather than ignoring them. Not a security fix -
        # an unknown key was already being discarded - a bug-finding one. It is
        # also what makes a frontend that tries to send creator_id fail loudly
        # instead of being silently, invisibly ignored.
        extra="forbid",
    )

    @field_validator("post_date", check_fields=False)
    @classmethod
    def plausible_post_date(cls, value: date | None) -> date | None:
        if value is None:
            return value

        if value < EARLIEST_POST_DATE:
            raise ValueError(f"must not be earlier than {EARLIEST_POST_DATE.isoformat()}")

        if value > date.today() + FUTURE_DATE_SLACK:
            raise ValueError("must not be in the future - a recap describes something that happened")

        return value

    @field_validator("images", check_fields=False)
    @classmethod
    def no_duplicate_images(cls, value: list[PostImageInput] | None):
        """The same photograph twice is a mistake, never an intention."""
        if value is None:
            return value

        keys = [image.image_key for image in value]

        if len(keys) != len(set(keys)):
            raise ValueError("the same image cannot appear twice in one post")

        return value


class PostCreate(PostBase):
    """Request body for POST /posts.

    No creator field, on purpose and permanently. The author comes from the
    verified session, so there is nowhere for a request to claim one - and
    extra="forbid" turns an attempt into a 422 rather than a silent no-op.
    """

    title: str | None = Field(default=None, max_length=TITLE_MAX_LENGTH)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    location: str | None = Field(default=None, max_length=LOCATION_MAX_LENGTH)

    post_date: date

    # Optional, and optional in both directions: a recap of an event, or a
    # standalone post for something that never had one. The database allows one
    # recap per event; the service turns a second attempt into a 409.
    event_id: UUID | None = None

    published: bool = False

    images: list[PostImageInput] = Field(default_factory=list, max_length=MAX_IMAGES)

    @model_validator(mode="after")
    def published_posts_need_images(self):
        """An empty gallery is a draft, not a post.

        This module is image-first: a published recap with no photographs is
        not a recap. Drafts are exempt because that is exactly how one is
        written - create it, then add photographs as they are uploaded.

        Only enforceable here for create. A PATCH that sends nothing but
        published=true carries no images for the schema to look at, so the
        service re-checks it against the stored row.
        """
        if self.published and not self.images:
            raise ValueError(
                "a published post needs at least one image - save it as a draft instead"
            )

        return self


class PostUpdate(PostBase):
    """Request body for PATCH /posts/{id}. Every field optional.

    Optional means "may be omitted", which is not the same as "may be null".
    Both arrive as None, so the service reads the payload with
    exclude_unset=True to tell "leave the caption alone" apart from "clear the
    caption" - and, for event_id, "leave it linked" apart from "unlink it".

    images follows the same rule with a third meaning: omitted leaves the
    gallery untouched, [] empties it, and a list replaces it wholesale. Whole
    replacement rather than an add/remove/reorder protocol, because the form
    already holds the finished gallery - sending it is simpler than describing
    how to get there.
    """

    title: str | None = Field(default=None, max_length=TITLE_MAX_LENGTH)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    location: str | None = Field(default=None, max_length=LOCATION_MAX_LENGTH)
    post_date: date | None = None
    event_id: UUID | None = None
    published: bool | None = None
    images: list[PostImageInput] | None = Field(default=None, max_length=MAX_IMAGES)


class PostImageResponse(BaseModel):
    """One photograph on the way out."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_order: int

    # Published, unlike the equivalent field on an event's banner.
    #
    # A gallery has to survive being edited: PATCH replaces the whole list, so
    # the form must be able to send back the images it is keeping, and a key is
    # the only identity it has for them. Hiding it would make every edit drop
    # every existing photograph.
    #
    # Nothing is given away by publishing it. The key is the public URL minus a
    # configured prefix, so anyone holding the URL already has it.
    image_key: str

    @computed_field
    @property
    def image_url(self) -> str | None:
        """The stored key, resolved to something a browser can load."""
        return resolve_public_url(self.image_key)


class PostEventResponse(BaseModel):
    """Just enough of a linked event to render a link back to it.

    Not EventResponse. That would drag its creator and banner along, and - once
    an event learns to report its recap - point back at the post that embeds
    it. Two schemas that contain each other serialise until something stops
    them.

    published travels so the page can decline to link the public at a draft.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    start_datetime: datetime
    published: bool


class PostResponse(BaseModel):
    """What every post endpoint returns.

    Requires creator, event and images to be loaded already. Touching an
    unloaded relationship inside async SQLAlchemy raises MissingGreenlet, so
    the service eager-loads all three on every query that feeds this.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str | None
    description: str | None
    location: str | None
    post_date: date
    published: bool
    created_at: datetime
    updated_at: datetime

    creator: PublicUserResponse | None
    event: PostEventResponse | None

    # Ordered by the relationship itself, so no call site can forget to sort
    # and render somebody's gallery shuffled.
    images: list[PostImageResponse]


# The same page shape every module returns - see schemas/pagination.py.
PostListResponse = Page[PostResponse]
