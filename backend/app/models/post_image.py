from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.post import Post


class PostImage(TimestampMixin, Base):
    """One photograph in a post's gallery.

    A row rather than an entry in an array column on posts, because reordering,
    deleting one image, and giving each image an identity all need something a
    row has and an array element does not.
    """

    __tablename__ = "post_images"

    __table_args__ = (
        # Every read of this table asks the same question - "this post's images,
        # in order" - so the index covers both halves of it and the database
        # never has to sort the result.
        Index("ix_post_images_post_id_display_order", "post_id", "display_order"),
    )

    # Part of the storage key, which is the main reason each image needs an
    # identity of its own: posts/{post_id}/{image_id}.jpg
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # CASCADE, unlike every other foreign key in this schema. An image row
    # belonging to no post is not a historical record, it is garbage.
    #
    # Worth being clear about what this does not do: the database deletes rows,
    # not objects in the bucket. Deleting a post will leave its files orphaned
    # in storage until something goes and removes them.
    post_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
    )

    # An object key - "posts/<post_id>/<image_id>.jpg" - never a full URL. The
    # domain the bucket is served from stays configuration instead of becoming
    # data copied across every row, so moving providers is one setting rather
    # than a migration. storage_service.resolve_public_url builds the URL when
    # the API answers.
    image_key: Mapped[str] = mapped_column(String(500), nullable=False)

    # Presentation order within the post.
    #
    # Deliberately not unique per post. A unique (post_id, display_order) sounds
    # correct and makes reordering miserable - swapping two images violates it
    # the moment the first row is written, so every swap would need a temporary
    # value or a deferred constraint. A duplicate here is a cosmetic bug, not
    # corruption, and it is not worth that price.
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    post: Mapped["Post"] = relationship(back_populates="images")
