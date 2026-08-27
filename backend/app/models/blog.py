from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class Blog(TimestampMixin, Base):
    """An editorial article: an announcement, a guide, a write-up.

    The counterpart to Post, and deliberately its inverse. A post is
    photographs with a caption underneath; a blog is prose with a picture at
    the top. That one difference decides most of this file - no child table,
    a required title, a slug instead of a UUID in the public URL, and a
    publication instant instead of an author-chosen calendar label.

    Structurally the simplest module in the project: one table, one
    relationship, no cascade. The only machinery it adds anywhere is slug
    generation, and that lives in the service.
    """

    __tablename__ = "blogs"

    __table_args__ = (
        # The slug is the public URL, so "unique" is not a nicety - two rows
        # sharing one would make an address ambiguous, and whichever row the
        # query happened to return first would win.
        #
        # Same lesson as uq_posts_event_id: the service will try slug, slug-2,
        # slug-3 to produce a readable name, but that loop is ergonomics, not
        # the guarantee. Two simultaneous creates both compute "-2", both pass
        # their check, and only this constraint stops the second insert.
        #
        # Named explicitly so the service can recognise this particular failure
        # and retry, rather than surfacing an opaque driver error.
        UniqueConstraint("slug", name="uq_blogs_slug"),
        # The public list is always "WHERE published ORDER BY published_at
        # DESC". This is a partial index: it indexes only the rows matching
        # that WHERE, so drafts never enter it at all. Smaller than a full
        # index, and it stays small even if the drafts folder does not.
        #
        # A plain index on `published` alone would be close to useless - two
        # distinct values means most rows match, and the planner would usually
        # rather scan the table than bounce through an index for half of it.
        #
        # Indexed ascending even though the query sorts descending. A btree can
        # be walked backwards at the same cost, so a DESC index only earns its
        # keep for multi-column sorts that mix directions.
        Index("ix_blogs_published_at", "published_at", postgresql_where=text("published")),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Required, unlike Post.title. An album with no title is still an album;
    # an article with no title is not an article - and the slug is derived from
    # it, so an empty one would leave the public URL with nothing to be made of.
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # The public URL. "Understanding Web3" is stored as "understanding-web3",
    # and the article lives at /blog/understanding-web3 forever.
    #
    # Wider than title on purpose. Slugification only removes characters, so a
    # 200-character title cannot produce a longer slug - but a collision suffix
    # ("-2", or a random token when the retries run out) is appended after
    # truncation, and this headroom is where it goes.
    slug: Mapped[str] = mapped_column(String(220), nullable=False)

    # The card summary and the <meta name="description"> a search engine shows
    # under the headline. A stored column rather than the first N characters of
    # content, for two reasons: truncating HTML mid-tag produces broken markup,
    # and what a reader should be told about an article is an editorial
    # decision, not a substring.
    #
    # 300 because search engines cut the snippet around 155-160 characters and
    # a little room to work in beats a hard stop at the limit.
    #
    # Nullable so a draft can exist before anyone has written one. Required to
    # publish - enforced in the schema and the service, the same shape as a
    # published post needing an image.
    excerpt: Mapped[str | None] = mapped_column(String(300))

    # The article. Sanitised HTML, cleaned on write by html_service exactly as
    # an event description and a post caption are.
    #
    # Opaque to the backend: stored and served, never parsed. That is what
    # keeps the format a frontend decision - swapping the editor later, or
    # importing this into a structured document model, touches nothing here.
    #
    # Text rather than String(n) because Postgres stores both identically. The
    # friendly cap lives in the schema, where exceeding it returns a readable
    # 422 instead of a database error.
    #
    # Nullable so "New Blog, type a title, save" works. Required to publish.
    content: Mapped[str | None] = mapped_column(Text)

    # One image, not a gallery - the exact inverse of Posts.
    #
    # post_images is a table because a gallery has ordering, per-row identity,
    # and a reorder that two people can perform at once. A blog has one cover.
    # A child table for a guaranteed-single row is a join paid for on every
    # read, forever.
    #
    # Holds an object key, "blogs/<id>/cover.jpg", never a URL - so the domain
    # serving it stays configuration rather than becoming data copied across
    # every row. storage_service.resolve_public_url turns it into a URL.
    cover_image_key: Mapped[str | None] = mapped_column(String(500))

    # Fails closed, like every other module. An accidental POST leaves a draft.
    published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # When this became public - which none of the other three timestamps say.
    #
    # An article is drafted on the 3rd, edited on the 5th, published on the
    # 10th, and typo-fixed on the 20th. created_at says the 3rd. updated_at
    # says the 20th. Neither is what belongs under the headline, what the
    # public list sorts by, or what an RSS feed puts in pubDate.
    #
    # NULL is meaningful here rather than missing: a draft has no publication
    # date because it has not been published.
    #
    # Set once, on the first false->true transition, and never touched again -
    # see blog_service. The alternative, resetting on every publish, means the
    # routine cycle of unpublish, fix a typo, republish silently rewrites the
    # publication date and reshuffles the public list. That is common; an
    # accidental publish leaving a stale date is rare, and is correctable
    # because the field is editable through the API.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Same reasoning as Event.creator_id and Post.creator_id, and deliberately
    # the same name: the frontend reads event.creator, post.creator and
    # blog.creator, so anything rendering "who made this" works on all three.
    #
    # SET NULL rather than CASCADE - the community's writing outlives whoever
    # posted it, and that is the only reason this is nullable. It is always set
    # on create.
    creator_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    creator: Mapped["User | None"] = relationship(back_populates="created_blogs")
