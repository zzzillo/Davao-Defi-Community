"""Everything the application knows how to do with a post.

Routers translate HTTP into these calls and their results back into HTTP.
Nothing in here imports FastAPI, and nothing in here checks permissions - that
belongs to the router, because identity arrives with the request.

Audit logging seam: every mutating function returns the affected Post, and the
router is the layer holding current_user. When Activity Logs arrives, each
route gains one log_activity(...) line and nothing in this file changes.
"""

import logging
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.post import Post
from app.models.post_image import PostImage
from app.schemas.post import PostCreate, PostImageInput, PostUpdate
from app.services.exceptions import (
    LinkedEventNotFound,
    PublishedPostNeedsImage,
    RecapAlreadyExists,
)
from app.services.html_service import sanitize_html
from app.services.persistence import integrity_constraint, refresh_for_response

logger = logging.getLogger(__name__)

# The name Postgres gives the constraint behind "one recap per event". Matched
# against a failed insert so that particular collision becomes a readable error
# instead of an opaque driver exception. It is declared explicitly in
# models/post.py precisely so this string is stable.
RECAP_CONSTRAINT = "uq_posts_event_id"

# PostResponse reads all three of these. Touching an unloaded relationship in
# async SQLAlchemy raises MissingGreenlet, so every query that feeds a response
# loads them up front - defined once here so no query can quietly omit one.
RESPONSE_LOADERS = (
    selectinload(Post.creator),
    selectinload(Post.event),
    selectinload(Post.images),
)


# What PostResponse reads and the flush leaves expired or unloaded.
RESPONSE_FIELDS = ["created_at", "updated_at", "creator", "event", "images"]


async def _refresh_for_response(db: AsyncSession, post: Post) -> Post:
    """Reload what the database owns, so the row is safe to serialise."""
    return await refresh_for_response(db, post, RESPONSE_FIELDS)


async def _assert_event_is_free(
    db: AsyncSession,
    event_id: UUID,
    *,
    excluding_post_id: UUID | None = None,
) -> None:
    """Check the event exists and has no recap yet.

    Checked here so the caller gets "that event already has a recap" rather
    than a constraint violation. This check is *not* what enforces the rule -
    two simultaneous requests can both pass it, and only the unique index stops
    the second insert. It exists for the error message; the database exists for
    the guarantee.

    excluding_post_id lets a post keep the event it is already linked to during
    an update, instead of colliding with itself.
    """
    exists = await db.scalar(select(Event.id).where(Event.id == event_id))

    if exists is None:
        raise LinkedEventNotFound(f"No event with id {event_id}")

    conditions = [Post.event_id == event_id]

    if excluding_post_id is not None:
        conditions.append(Post.id != excluding_post_id)

    taken = await db.scalar(select(Post.id).where(*conditions))

    if taken is not None:
        raise RecapAlreadyExists(f"Event {event_id} already has a recap post")


def _apply_images(post: Post, images: list[PostImageInput]) -> None:
    """Make the post's gallery match the list it was given, in that order.

    Reconciled by image_key rather than emptied and rebuilt. A key is the one
    piece of identity the client can hand back for a photograph it is keeping,
    so matching on it means an image that survives an edit keeps its row - and
    therefore its id, its created_at, and anything that may one day reference
    it. Rebuilding would silently give every kept photograph a new identity.

    display_order comes from position in the list. The client never sends it,
    so the order shown and the order stored cannot disagree.
    """
    surviving = {image.image_key: image for image in post.images}

    rebuilt: list[PostImage] = []

    for order, item in enumerate(images):
        # pop, so whatever is left in `surviving` afterwards is exactly the set
        # the client dropped.
        image = surviving.pop(item.image_key, None)

        if image is None:
            image = PostImage(image_key=item.image_key)

        image.display_order = order
        rebuilt.append(image)

    # Assigning the collection is what deletes the leftovers: the relationship
    # is cascade="all, delete-orphan", so an image removed from this list is
    # removed from the table.
    post.images = rebuilt


async def list_posts(
    db: AsyncSession,
    *,
    search: str | None = None,
    include_unpublished: bool = False,
    creator_id: UUID | None = None,
    event_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Post], int]:
    """A page of posts, plus how many matched before paging was applied.

    Every flag is keyword-only. list_posts(db, True) cannot silently mean
    "include drafts" - a visibility switch should never be a positional
    argument that reads like a typo.

    include_unpublished defaults to False, so a route that forgets to ask for
    drafts shows none. Authorization lives in the router; this default is what
    makes forgetting it harmless instead of a leak.
    """
    conditions = []

    if not include_unpublished:
        conditions.append(Post.published.is_(True))

    if search:
        # ilike is case-insensitive LIKE. The term is a bound parameter, so it
        # stays data rather than SQL no matter what the visitor typed.
        term = f"%{search}%"
        conditions.append(or_(Post.title.ilike(term), Post.description.ilike(term)))

    if creator_id is not None:
        conditions.append(Post.creator_id == creator_id)

    if event_id is not None:
        conditions.append(Post.event_id == event_id)

    total = await db.scalar(select(func.count()).select_from(Post).where(*conditions))

    # Newest recap first. post_date is a calendar day, so a busy day produces
    # ties - created_at breaks them in the order they were actually written,
    # and id breaks anything left. Without that last tiebreaker, two rows are
    # free to swap places between page 1 and page 2: one gets shown twice and
    # the other never appears at all.
    result = await db.execute(
        select(Post)
        .options(*RESPONSE_LOADERS)
        .where(*conditions)
        .order_by(Post.post_date.desc(), Post.created_at.desc(), Post.id)
        .limit(limit)
        .offset(offset)
    )

    return list(result.scalars().all()), total or 0


async def get_post(
    db: AsyncSession,
    post_id: UUID,
    *,
    include_unpublished: bool = False,
) -> Post | None:
    """One post, or None when it does not exist or is not visible to the caller.

    Visibility is a condition inside the query rather than a check afterwards,
    so a draft is genuinely not found. The router can answer 404 without having
    to choose between "missing" and "hidden" - and answering 403 would confirm
    the post exists, turning guessed ids into a working existence oracle.
    """
    conditions = [Post.id == post_id]

    if not include_unpublished:
        conditions.append(Post.published.is_(True))

    result = await db.execute(
        select(Post).options(*RESPONSE_LOADERS).where(*conditions)
    )

    return result.scalar_one_or_none()


async def create_post(
    db: AsyncSession,
    payload: PostCreate,
    *,
    creator_id: UUID,
) -> Post:
    """Store a new post and its gallery, attributed to the caller.

    creator_id is a parameter rather than a field on the payload because the
    author comes from the verified session. The schema cannot carry it, so no
    request can claim it.
    """
    values = payload.model_dump(exclude={"images"})

    # Cleaned here rather than where it is rendered, so the row is safe for
    # every reader there will ever be. See html_service for why.
    values["description"] = sanitize_html(values["description"])

    if values.get("event_id") is not None:
        await _assert_event_is_free(db, values["event_id"])

    post = Post(**values, creator_id=creator_id)
    _apply_images(post, payload.images)

    db.add(post)

    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()

        # The check above lost a race with a simultaneous request. The database
        # caught what application code could not, and this turns its answer
        # back into the same error the check would have raised.
        if integrity_constraint(error) == RECAP_CONSTRAINT:
            raise RecapAlreadyExists(
                f"Event {values['event_id']} already has a recap post"
            ) from error

        raise

    logger.info(
        "Post %s created by user %s with %d image(s)",
        post.id,
        creator_id,
        len(payload.images),
    )

    return await _refresh_for_response(db, post)


async def update_post(
    db: AsyncSession,
    post: Post,
    payload: PostUpdate,
) -> Post:
    """Apply a partial update to a post the router has already loaded."""
    # exclude_unset is what separates "leave the caption alone" from "clear the
    # caption". Both arrive as None; only the second one lands in this dict.
    changes = payload.model_dump(exclude_unset=True, exclude={"images"})

    if "description" in changes:
        changes["description"] = sanitize_html(changes["description"])

    # Omitted means "leave the gallery alone"; [] means "empty it". An explicit
    # null is treated as omitted, because [] is already the way to say empty
    # and two spellings for one action is how callers end up guessing.
    replacing_images = "images" in payload.model_fields_set and payload.images is not None

    # Judged against the row as it will exist, not as the payload describes it.
    # A PATCH carrying only published=true gives a schema nothing to look at;
    # here both halves are in reach.
    will_be_published = changes.get("published", post.published)
    image_count = len(payload.images) if replacing_images else len(post.images)

    if will_be_published and image_count == 0:
        raise PublishedPostNeedsImage(
            "a published post needs at least one image - save it as a draft instead"
        )

    if changes.get("event_id") is not None:
        await _assert_event_is_free(db, changes["event_id"], excluding_post_id=post.id)

    for field, value in changes.items():
        setattr(post, field, value)

    if replacing_images:
        _apply_images(post, payload.images)

    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()

        if integrity_constraint(error) == RECAP_CONSTRAINT:
            raise RecapAlreadyExists(
                f"Event {changes.get('event_id')} already has a recap post"
            ) from error

        raise

    logger.info("Post %s updated, fields: %s", post.id, sorted(changes))

    return await _refresh_for_response(db, post)


async def delete_post(db: AsyncSession, post: Post) -> None:
    """Remove a post and its image rows permanently.

    A hard delete on purpose, matching events: the planned Activity Log records
    who deleted what, and soft deletion would put a deleted_at filter on every
    query this project ever writes, where forgetting it once quietly
    resurrects the row.

    The image *rows* go with it, by ON DELETE CASCADE. The image *files* do
    not - storage knows nothing about this transaction, so the objects stay in
    the bucket until something goes and removes them. That cleanup belongs with
    the upload code, and does not exist yet.
    """
    post_id = post.id
    orphaned_keys = [image.image_key for image in post.images]

    await db.delete(post)
    await db.commit()

    logger.info(
        "Post %s deleted; %d stored object(s) now unreferenced: %s",
        post_id,
        len(orphaned_keys),
        orphaned_keys,
    )
