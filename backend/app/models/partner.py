from uuid import UUID, uuid4

from sqlalchemy import Index, String, column, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TimestampMixin


class Partner(TimestampMixin, Base):
    """An organization that collaborates with the community.

    The smallest table in this project, and deliberately so: a name and a logo.
    A partner is a logo on a wall, not a document somebody navigates to.

    That one sentence decides everything this file does not have. No slug,
    because there is no detail page to address. No published flag, because
    there is no half-written state - the other three modules are authored, and
    an article mid-sentence must not reach the public, but a partnership either
    exists or it does not. No creator, because a partner has no author to
    credit; "who added this" is an audit question and Activity Logs is what
    answers audit questions.

    No relationships either, which is why nothing in the service eager-loads
    anything: the MissingGreenlet hazard that shaped the other three modules
    simply cannot occur here.
    """

    __tablename__ = "partners"

    __table_args__ = (
        # Unique on the LOWERCASED name, not on the name.
        #
        # A plain UNIQUE(name) compares byte for byte, so "Nexus Technologies"
        # and "nexus technologies" would both be accepted - two rows for one
        # partner, and nothing would notice until somebody looked at the wall
        # and saw the same logo twice.
        #
        # A functional index compares what a person means rather than what they
        # typed. Whitespace is handled before this ever runs: the schema's
        # str_strip_whitespace turns "  Nexus  " into "Nexus". Neither catches
        # "Nexus Technologies Inc." against "Nexus Technologies", and nothing
        # could without also rejecting legitimately similar names.
        #
        # Same lesson as uq_posts_event_id and uq_blogs_slug: this is the
        # guarantee, and the service's check is only the error message. Two
        # simultaneous requests can both look, both find nothing, and both
        # insert - only an index is atomic.
        #
        # Named explicitly so partner_service can recognise this particular
        # failure and answer 409 rather than a generic database error.
        #
        # column("name") rather than the bare string: func.lower("name")
        # renders lower('name') - the literal text, indexed once for every
        # row - which would build happily and enforce nothing.
        Index("uq_partners_name_lower", func.lower(column("name")), unique=True),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Capped at 200 to match Event.title and Blog.title. An organization name is
    # shorter than either in practice, but a fourth number would be one more
    # thing to keep straight for no gain.
    #
    # The column is the hard limit; the schema's cap produces a readable 422
    # before the database ever has to complain.
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # A reference to an image, never the image itself, and never a URL - the
    # key is "partners/<id>/logo.png" and storage_service.resolve_public_url
    # turns it into something a browser can load. That is what keeps the domain
    # serving these files configuration instead of data copied across rows.
    #
    # Nullable for two reasons, and only the first is temporary. Uploads do not
    # exist yet, so NOT NULL would make creating a partner impossible today.
    # And after R2 arrives it should stay nullable anyway: a partner may be
    # registered before their brand assets turn up, and a card showing a name
    # in a bordered box is degraded rather than broken.
    logo_key: Mapped[str | None] = mapped_column(String(500))
