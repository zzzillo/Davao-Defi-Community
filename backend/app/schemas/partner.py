from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.schemas.common import validate_storage_key
from app.schemas.pagination import Page
from app.services.storage_service import resolve_public_url

# Kept beside the schemas so the numbers that must match app/models/partner.py
# are visible in one place. The column is the hard limit; these produce a
# readable 422 before the database ever has to complain.
NAME_MAX_LENGTH = 200
LOGO_KEY_MAX_LENGTH = 500


class PartnerBase(BaseModel):
    """The rules shared by create and update. Deliberately declares no fields.

    Create requires a name; update must not, or a PATCH that only replaces a
    logo would have to resend the name too. So the two shapes differ, and what
    they share is the validation. check_fields=False tells Pydantic the named
    field arrives in the subclasses rather than here.

    The whole file is this short because a partner has no authored text. There
    is no description to sanitise, no slug to validate, no publish rule to
    enforce, and no timestamp a client may set.
    """

    model_config = ConfigDict(
        # Turns "  Nexus Technologies  " into "Nexus Technologies" before any
        # length check runs. That matters more here than anywhere else in this
        # project: the database's unique index folds case but not whitespace,
        # so " Nexus" and "Nexus" would be two rows if this line were missing.
        # This is the layer that makes that impossible.
        str_strip_whitespace=True,
        # Reject unknown keys rather than ignoring them. A bug-finding measure,
        # not a security one - an unknown key was already being discarded. It
        # is what turns a client sending "logo_url" instead of "logo_key" into
        # a loud 422 rather than a partner silently saved without a logo.
        extra="forbid",
    )

    @field_validator("logo_key", check_fields=False)
    @classmethod
    def logo_must_be_a_key(cls, value: str | None) -> str | None:
        """See schemas/common.validate_storage_key.

        Third consumer of that rule, after post images and blog covers: rows
        hold keys so the domain serving them stays configuration. One bucket
        URL written into a row is a row that breaks the day the bucket moves,
        silently, by serving a dead image.
        """
        return validate_storage_key(value, example="partners/<partner_id>/logo.png")


class PartnerCreate(PartnerBase):
    """Request body for POST /partners.

    Two fields, and one of them is optional. This is the entire write contract
    for the module.
    """

    # min_length=1 runs after whitespace stripping, so a name of pure spaces
    # becomes "" and fails here rather than reaching the database as a blank
    # row that no unique index would object to.
    name: str = Field(min_length=1, max_length=NAME_MAX_LENGTH)

    # Optional because uploads do not exist yet, and still optional afterwards:
    # a partner may be registered before their brand assets arrive. A card
    # showing a name in a bordered box is degraded rather than broken.
    logo_key: str | None = Field(default=None, max_length=LOGO_KEY_MAX_LENGTH)


class PartnerUpdate(PartnerBase):
    """Request body for PATCH /partners/{id}. Every field optional.

    Optional means "may be omitted", which is not the same as "may be null".
    Both arrive as None, so the service reads the payload with
    exclude_unset=True to tell "leave the logo alone" apart from "remove the
    logo" - the second being how an official clears a logo that turned out to
    be wrong.

    name is nullable in the type but never null in practice: sending
    {"name": null} fails min_length, which is the correct answer. A partner
    without a name is not a partner.
    """

    name: str | None = Field(default=None, min_length=1, max_length=NAME_MAX_LENGTH)
    logo_key: str | None = Field(default=None, max_length=LOGO_KEY_MAX_LENGTH)


class PartnerResponse(BaseModel):
    """What every partner endpoint returns.

    Requires nothing to be loaded first, unlike every other response schema in
    this project. Partner has no relationships, so the MissingGreenlet hazard
    that shaped the other three services cannot occur here and no query needs
    an eager loader.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime

    # Published rather than excluded, matching post images and blog covers.
    #
    # The edit form needs to tell "this partner has no logo" apart from "this
    # partner has a logo we cannot currently build a URL for" - which is every
    # logo until R2 is configured, since resolve_public_url returns None when
    # STORAGE_PUBLIC_BASE_URL is unset. Hiding the key would make an existing
    # logo look missing and invite somebody to overwrite it.
    #
    # Nothing is given away: the key is the public URL minus a configured
    # prefix, so anyone holding the URL already has it.
    logo_key: str | None

    @computed_field
    @property
    def logo_url(self) -> str | None:
        """The stored key, resolved to something a browser can load."""
        return resolve_public_url(self.logo_key)


# The same page shape every module returns - see schemas/pagination.py.
#
# Kept even though a partner list is short and unlikely to need a second page.
# A frontend that can render one paged list can render all of them, and the
# officials' table already knows this shape from three other modules.
PartnerListResponse = Page[PartnerResponse]
