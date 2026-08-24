from datetime import datetime
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

from app.services.storage_service import resolve_public_url

# Kept beside the schemas rather than inlined so the numbers that must match
# app/models/event.py are visible in one place. The column is the hard limit;
# these produce a readable 422 before the database ever has to complain.
TITLE_MAX_LENGTH = 200
LOCATION_MAX_LENGTH = 300
BANNER_KEY_MAX_LENGTH = 500
# No column cap on description - Text is unbounded - so this number exists
# purely to stop somebody pasting a novel into a form field.
DESCRIPTION_MAX_LENGTH = 5000


class EventBase(BaseModel):
    """The rules shared by create and update. Deliberately declares no fields.

    Create requires a title; update must not, or every PATCH would have to
    resend the whole event. So the two shapes differ, and what they share is
    the validation, not the field list. check_fields=False tells Pydantic the
    named fields arrive in the subclasses rather than here.
    """

    model_config = ConfigDict(
        # Turns "  Meetup  " into "Meetup" before any length check runs, so a
        # title of pure whitespace becomes "" and fails min_length instead of
        # sneaking through.
        str_strip_whitespace=True,
        # Reject unknown keys instead of ignoring them. This is not a security
        # fix - an unknown key was already being discarded - it is a bug-finding
        # one. Without it, a client sending "publish" instead of "published"
        # gets a cheerful 200 and an event that never publishes.
        extra="forbid",
    )

    @field_validator("start_datetime", "end_datetime", check_fields=False)
    @classmethod
    def require_utc_offset(cls, value: datetime | None) -> datetime | None:
        """Refuse datetimes that do not say which moment they mean.

        A naive datetime reaching a TIMESTAMPTZ column is read in whatever the
        database session's timezone happens to be. That is a wrong hour with no
        error attached to it - the worst kind of bug. JavaScript's
        toISOString() always includes an offset, so this costs the client
        nothing and closes the hole for good.
        """
        if value is not None and value.tzinfo is None:
            raise ValueError(
                "must include a UTC offset, for example 2026-09-01T18:00:00+08:00"
            )

        return value

    @model_validator(mode="after")
    def end_must_follow_start(self):
        """Reject an event that ends before - or exactly when - it begins.

        Only fires when the payload carries both values. A PATCH that sends
        only end_datetime is checked in the service layer instead, against the
        start_datetime already stored on the row.
        """
        if self.start_datetime is None or self.end_datetime is None:
            return self

        if self.end_datetime <= self.start_datetime:
            raise ValueError("end_datetime must be after start_datetime")

        return self


class EventCreate(EventBase):
    """Request body for POST /events.

    creator_id is absent on purpose. The author is taken from the verified
    session in the router, never from the request. A field the client cannot
    send is a field the client cannot forge - the same reasoning that keeps
    role out of every user-facing schema.
    """

    title: str = Field(min_length=1, max_length=TITLE_MAX_LENGTH)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    location: str | None = Field(default=None, max_length=LOCATION_MAX_LENGTH)
    start_datetime: datetime
    end_datetime: datetime | None = None
    banner_image_key: str | None = Field(default=None, max_length=BANNER_KEY_MAX_LENGTH)
    # Defaults to a draft. Publishing is opt-in at creation and a separate
    # decision afterwards.
    published: bool = False


class EventUpdate(EventBase):
    """Request body for PATCH /events/{id}. Every field optional.

    Optional here means "may be omitted", which is not the same as "may be
    null". Both arrive as None, so the service reads the payload with
    exclude_unset=True to tell "leave the description alone" apart from
    "clear the description".
    """

    title: str | None = Field(default=None, min_length=1, max_length=TITLE_MAX_LENGTH)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    location: str | None = Field(default=None, max_length=LOCATION_MAX_LENGTH)
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    banner_image_key: str | None = Field(default=None, max_length=BANNER_KEY_MAX_LENGTH)
    published: bool | None = None


class EventCreatorResponse(BaseModel):
    """The slice of a user that is safe to show beside an event.

    Not UserResponse, and never UserResponse: GET /events is public, and
    UserResponse carries clerk_user_id, role, and permissions. Embedding it
    would publish a list of who your officials are and what each of them can
    do, to anyone who loads the events page.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str


class EventResponse(BaseModel):
    """What every event endpoint returns.

    Requires Event.creator to be loaded already. Touching an unloaded
    relationship inside async SQLAlchemy raises MissingGreenlet, so the service
    layer eager-loads it with selectinload on every query that feeds this.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    location: str | None
    start_datetime: datetime
    end_datetime: datetime | None
    published: bool
    created_at: datetime
    updated_at: datetime
    creator: EventCreatorResponse | None

    # Read off the row so the URL below can be built, then excluded from the
    # output. The contract we publish is a URL; where the file actually lives
    # stays an implementation detail we are free to change.
    banner_image_key: str | None = Field(default=None, exclude=True)

    @computed_field
    @property
    def banner_image_url(self) -> str | None:
        """The stored reference, resolved to something a browser can load."""
        return resolve_public_url(self.banner_image_key)


class EventListResponse(BaseModel):
    """A page of events plus the total that matched before paging.

    Same shape as UserListResponse, so the frontend's paging code works against
    either without a second implementation.
    """

    items: list[EventResponse]
    total: int
