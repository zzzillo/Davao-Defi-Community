from datetime import datetime, timedelta, timezone
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
from app.services.slug_service import SLUG_MAX_LENGTH, is_valid_slug
from app.services.storage_service import resolve_public_url

# Kept beside the schemas so the numbers that must match app/models/blog.py are
# visible in one place. The column is the hard limit; these produce a readable
# 422 before the database ever has to complain.
TITLE_MAX_LENGTH = 200
EXCERPT_MAX_LENGTH = 300
COVER_KEY_MAX_LENGTH = 500

# No column cap on content - Text is unbounded - so this exists to stop a paste
# bomb, not to constrain a writer. Roughly fifteen thousand words, which is
# several times longer than anything this community is likely to publish.
#
# Twenty times the cap on a post caption, and that gap is the whole difference
# between the two modules: a caption sits under photographs, an article is the
# thing itself.
CONTENT_MAX_LENGTH = 100_000

# published_at is editable, so an article imported from elsewhere can carry its
# real publication date. A date in the future is almost always a typo, but "the
# future" depends on where the author is standing - the server reads now() in
# UTC and an official in Davao is eight hours ahead of it.
PUBLISHED_AT_SLACK = timedelta(days=1)


class BlogBase(BaseModel):
    """The rules shared by create and update. Deliberately declares no fields.

    Create requires a title; update must not, or every PATCH would have to
    resend the whole article. So the two shapes differ, and what they share is
    the validation. check_fields=False tells Pydantic the named fields arrive
    in the subclasses rather than here.
    """

    model_config = ConfigDict(
        # Turns "  Understanding Web3  " into "Understanding Web3" before any
        # length check runs, so a title of pure whitespace fails min_length
        # instead of sneaking through and generating an empty slug.
        str_strip_whitespace=True,
        # Reject unknown keys rather than ignoring them. A bug-finding measure,
        # not a security one - an unknown key was already being discarded. It
        # is also what makes a frontend that tries to send creator_id fail
        # loudly instead of being silently, invisibly ignored.
        extra="forbid",
    )

    @field_validator("slug", check_fields=False)
    @classmethod
    def well_formed_slug(cls, value: str | None) -> str | None:
        """A hand-written slug must already be in slug form.

        Deliberately not slugified on the caller's behalf. Silently turning
        "My Article" into "my-article" would mean the value that comes back
        differs from the value that was sent, and the author only finds out by
        reading the response carefully. Refusing says what happened.
        """
        if value is None:
            return value

        if not is_valid_slug(value):
            raise ValueError(
                "must be lowercase letters, digits and single hyphens - "
                "for example understanding-web3 - and must not be a reserved word"
            )

        return value

    @field_validator("cover_image_key", check_fields=False)
    @classmethod
    def cover_must_be_a_key(cls, value: str | None) -> str | None:
        """See schemas/common.validate_storage_key."""
        return validate_storage_key(value, example="blogs/<blog_id>/cover.jpg")

    @field_validator("published_at", check_fields=False)
    @classmethod
    def plausible_published_at(cls, value: datetime | None) -> datetime | None:
        """Reject a naive datetime, and one implausibly far ahead.

        Naive first, and for the same reason as an event's start_datetime: a
        datetime with no offset reaching a TIMESTAMPTZ column is read in
        whatever the database session's timezone happens to be. That is a wrong
        hour with no error attached to it. JavaScript's toISOString() always
        includes an offset, so the rule costs a client nothing.
        """
        if value is None:
            return value

        if value.tzinfo is None:
            raise ValueError(
                "must include a UTC offset, for example 2026-08-27T18:00:00+08:00"
            )

        if value > datetime.now(timezone.utc) + PUBLISHED_AT_SLACK:
            raise ValueError("must not be in the future")

        return value


class BlogCreate(BlogBase):
    """Request body for POST /blogs.

    No creator field, on purpose and permanently. The author comes from the
    verified session, so there is nowhere for a request to claim one - and
    extra="forbid" turns an attempt into a 422 rather than a silent no-op.
    """

    title: str = Field(min_length=1, max_length=TITLE_MAX_LENGTH)

    # Optional because the normal path is automatic: omit it and the service
    # derives one from the title, resolving collisions itself.
    #
    # Accepted at all so an official can choose the URL deliberately - a
    # shorter one for a long headline, or a specific one for a campaign. Once
    # published it is frozen; see PublishedSlugImmutable.
    slug: str | None = Field(default=None, max_length=SLUG_MAX_LENGTH)

    excerpt: str | None = Field(default=None, max_length=EXCERPT_MAX_LENGTH)
    content: str | None = Field(default=None, max_length=CONTENT_MAX_LENGTH)

    cover_image_key: str | None = Field(default=None, max_length=COVER_KEY_MAX_LENGTH)

    published: bool = False

    # Normally left out and set by the service on first publish. Accepted so an
    # article imported from an old site can carry its real date.
    published_at: datetime | None = None

    @model_validator(mode="after")
    def published_blogs_need_a_body(self):
        """An article with no content, or no summary, is a draft.

        The excerpt is not decoration: it is the card summary and the snippet a
        search engine prints under the headline. Publishing without one puts a
        blank in both places.

        Drafts are exempt, because that is exactly how an article gets
        written - create it with a title, fill it in over several sittings.

        This catches the empty and the omitted. It cannot catch "<p></p>",
        which is a perfectly non-empty string that sanitising reduces to
        nothing; the service re-checks after cleaning.
        """
        if not self.published:
            return self

        missing = [
            name
            for name in ("content", "excerpt")
            if not (getattr(self, name) or "").strip()
        ]

        if missing:
            raise ValueError(
                f"a published article needs {' and '.join(missing)} - "
                "save it as a draft instead"
            )

        return self


class BlogUpdate(BlogBase):
    """Request body for PATCH /blogs/{id}. Every field optional.

    Optional means "may be omitted", which is not the same as "may be null".
    Both arrive as None, so the service reads the payload with
    exclude_unset=True to tell "leave the excerpt alone" apart from "clear the
    excerpt", and "leave the cover" apart from "remove the cover".

    The publish rules cannot live here. A PATCH sending only published=true
    carries no content for a validator to look at, so the check runs in the
    service against the row as it will exist.
    """

    title: str | None = Field(default=None, min_length=1, max_length=TITLE_MAX_LENGTH)
    slug: str | None = Field(default=None, max_length=SLUG_MAX_LENGTH)
    excerpt: str | None = Field(default=None, max_length=EXCERPT_MAX_LENGTH)
    content: str | None = Field(default=None, max_length=CONTENT_MAX_LENGTH)
    cover_image_key: str | None = Field(default=None, max_length=COVER_KEY_MAX_LENGTH)
    published: bool | None = None
    published_at: datetime | None = None


class BlogSummaryResponse(BaseModel):
    """An article without its body - what every list endpoint returns.

    THE ONE PLACE BLOGS DIVERGES FROM EVENTS AND POSTS.

    Those two return a single shape from both the list and the detail route,
    which is simpler and was right for them: an event has no large field, and a
    post caption is capped at five thousand characters.

    An article is capped at a hundred thousand. Twenty of them in one page is
    two megabytes of HTML sent to render a grid of cards that only ever shows a
    title, an excerpt, and a picture. The body is not merely unused there - it
    is most of the payload.

    So the list is served this, the detail route is served BlogResponse below,
    and inheritance is what stops the two drifting apart: every field added
    here appears in both.

    Requires Blog.creator to be loaded already. Touching an unloaded
    relationship inside async SQLAlchemy raises MissingGreenlet, so the service
    eager-loads it on every query that feeds this.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str

    # The public address. Travels in the list so a card can link straight to
    # /blog/<slug> without a second request.
    slug: str

    excerpt: str | None
    published: bool
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime

    creator: PublicUserResponse | None

    # Published rather than excluded, unlike an event's banner_image_key.
    #
    # Two reasons. The edit form needs to distinguish "this article has no
    # cover" from "this article has a cover we cannot currently build a URL
    # for" - which is every cover until R2 is configured, since resolve returns
    # None when STORAGE_PUBLIC_BASE_URL is unset. Hiding the key would make an
    # existing cover look missing and invite someone to overwrite it.
    #
    # And nothing is given away. The key is the public URL minus a configured
    # prefix, so anyone holding the URL already has it.
    cover_image_key: str | None

    @computed_field
    @property
    def cover_image_url(self) -> str | None:
        """The stored key, resolved to something a browser can load."""
        return resolve_public_url(self.cover_image_key)


class BlogResponse(BlogSummaryResponse):
    """One article, in full. What the detail routes return.

    Inherits every field above and adds the only one a list does not want.
    """

    # Sanitised on write, so this is safe for any reader - the public page, an
    # RSS feed, an email digest. See services/html_service.py.
    content: str | None


# The same page shape every module returns - see schemas/pagination.py.
BlogListResponse = Page[BlogSummaryResponse]
