"""Everything the application knows how to do with a blog article.

Routers translate HTTP into these calls and their results back into HTTP.
Nothing in here imports FastAPI, and nothing in here checks permissions - that
belongs to the router, because identity arrives with the request.

Audit logging seam: every mutating function returns the affected Blog, and the
router is the layer holding current_user. When Activity Logs arrives, each route
gains one log_activity(...) line and nothing in this file changes.

Simpler than post_service by some distance. No child table means no image
reconciliation, no delete-orphan cascade, and one eager loader instead of three.
The only machinery it adds anywhere is slug resolution, below.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.blog import Blog
from app.schemas.blog import BlogCreate, BlogUpdate
from app.services import slug_service
from app.services.exceptions import (
    PublishedBlogNeedsBody,
    PublishedSlugImmutable,
    SlugAlreadyExists,
)
from app.services.html_service import sanitize_html, strip_html
from app.services.persistence import integrity_constraint, refresh_for_response

logger = logging.getLogger(__name__)

# The name Postgres gives the constraint behind "one article per slug". Matched
# against a failed insert so that particular collision becomes a retry rather
# than an opaque driver error. Declared explicitly in models/blog.py precisely
# so this string is stable.
SLUG_CONSTRAINT = "uq_blogs_slug"

# How many "understanding-web3", "-2", "-3" variants to look for before giving
# up on a readable slug and appending a random token.
#
# Small on purpose. Each attempt is a round trip, and an unbounded loop turns
# one popular title into a hundred queries. Past the bound, a slug nobody will
# admire is better than a request that takes a second to fail.
SLUG_ATTEMPTS = 5

# How many times to re-derive a slug after the database rejects one. Distinct
# from SLUG_ATTEMPTS: that walks candidates the query says are free, this
# handles the ones a simultaneous request took in between.
#
# Only the first attempt walks numbers. Every retry uses a random token, so
# three is generous rather than a limit that concurrency can exhaust - see the
# comment in create_blog for why walking to the next number on a retry is
# actively wrong.
INSERT_ATTEMPTS = 3

# BlogResponse reads creator. Touching an unloaded relationship in async
# SQLAlchemy raises MissingGreenlet, so every query that feeds a response loads
# it up front - defined once here so no query can quietly omit it.
RESPONSE_LOADERS = (selectinload(Blog.creator),)

# What the flush leaves expired or unloaded - see services/persistence.py.
RESPONSE_FIELDS = ["created_at", "updated_at", "creator"]


async def _slug_is_taken(
    db: AsyncSession,
    slug: str,
    *,
    excluding_id: UUID | None = None,
) -> bool:
    """Whether another row already holds this slug.

    excluding_id lets an article keep the slug it already has during an update,
    instead of colliding with itself.
    """
    conditions = [Blog.slug == slug]

    if excluding_id is not None:
        conditions.append(Blog.id != excluding_id)

    return await db.scalar(select(Blog.id).where(*conditions)) is not None


async def _free_slug(
    db: AsyncSession,
    base: str,
    *,
    excluding_id: UUID | None = None,
) -> str:
    """The first unused slug from base, base-2, base-3, ... or one with a token.

    This is ergonomics, not the guarantee. Two simultaneous creates can both
    run this, both find "understanding-web3" free, and both try to insert it.
    Only uq_blogs_slug stops the second one; see the retry loop in create_blog.

    Never returns "" - an empty base becomes blog-<token>, which is what a
    title written entirely in Chinese or emoji reduces to. See slug_service.
    """
    if not base:
        base = slug_service.fallback_slug(uuid4().hex[:8])

    for candidate in slug_service.numbered_variants(base, attempts=SLUG_ATTEMPTS):
        if not await _slug_is_taken(db, candidate, excluding_id=excluding_id):
            return candidate

    # Five variants taken. A random token ends the search in one step rather
    # than continuing to guess at numbers other rows are also guessing at.
    return slug_service.with_token(base, uuid4().hex[:8])


def _clean(values: dict) -> dict:
    """Sanitise whatever authored text the payload carries, in place.

    Cleaned here rather than where it is rendered, so the row is safe for every
    reader there will ever be - the public page, an RSS feed, an email digest.
    A rule that must be re-applied at each new call site is a rule that
    eventually gets missed.

    content keeps its formatting; excerpt loses all of it, because an excerpt
    ends up inside a meta attribute and an RSS description where escaping rules
    differ. See html_service.
    """
    if "content" in values:
        values["content"] = sanitize_html(values["content"])

    if "excerpt" in values:
        values["excerpt"] = strip_html(values["excerpt"])

    return values


def _assert_publishable(*, published: bool, content: str | None, excerpt: str | None) -> None:
    """An article with no body, or no summary, cannot be published.

    Runs on the sanitised values, which is the point of it existing at all
    alongside the schema check. "<p></p>" is a perfectly non-empty string that
    a schema validator accepts and sanitising reduces to None - so the schema
    can say yes to an article that is, in fact, empty.
    """
    if not published:
        return

    missing = [
        name
        for name, value in (("content", content), ("excerpt", excerpt))
        if not (value or "").strip()
    ]

    if missing:
        raise PublishedBlogNeedsBody(
            f"a published article needs {' and '.join(missing)} - "
            "save it as a draft instead"
        )


async def list_blogs(
    db: AsyncSession,
    *,
    search: str | None = None,
    include_unpublished: bool = False,
    creator_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Blog], int]:
    """A page of articles, plus how many matched before paging was applied.

    Every flag is keyword-only. list_blogs(db, True) cannot silently mean
    "include drafts" - a visibility switch should never be a positional
    argument that reads like a typo.

    include_unpublished defaults to False, so a route that forgets to ask for
    drafts shows none. Authorization lives in the router; this default is what
    makes forgetting it harmless instead of a leak.

    SEARCH IS DELIBERATELY CONTAINED. It covers title and excerpt with ILIKE,
    which cannot use a btree index - a leading wildcard forces a sequential
    scan. That is fine into the low thousands of rows and is the ceiling.

    Lifting it does not touch the router, the schema, the frontend, or the URL,
    because the whole mechanism is these four lines. A pg_trgm GIN index makes
    the same ILIKE index-assisted with no query change at all; a tsvector
    column and websearch_to_tsquery buys stemming and ranking for a rewrite of
    this block alone.

    content is excluded on purpose. ILIKE over a hundred kilobytes of markup
    scans mostly tags, and "div" would match every article ever written. When
    full-text arrives, index title, excerpt and the stripped content together
    with weights.
    """
    conditions = []

    if not include_unpublished:
        conditions.append(Blog.published.is_(True))

    if search:
        # ilike is case-insensitive LIKE. The term is a bound parameter, so it
        # stays data rather than SQL no matter what the visitor typed.
        term = f"%{search}%"
        conditions.append(or_(Blog.title.ilike(term), Blog.excerpt.ilike(term)))

    if creator_id is not None:
        conditions.append(Blog.creator_id == creator_id)

    total = await db.scalar(select(func.count()).select_from(Blog).where(*conditions))

    # Newest publication first.
    #
    # No NULLS clause, on purpose. Postgres sorts DESC as NULLS FIRST, which
    # matches a backward scan of ix_blogs_published_at exactly - spelling
    # NULLS LAST here would forbid the planner from using the index this
    # project created for this query.
    #
    # The public list never sees a NULL, because publishing sets published_at.
    # The officials' list does, and NULLS FIRST puts drafts at the top - which
    # is where the article you are still writing belongs.
    #
    # created_at breaks ties and id breaks anything left. Without that last
    # tiebreaker two rows are free to swap places between page 1 and page 2:
    # one gets shown twice and the other never appears at all.
    result = await db.execute(
        select(Blog)
        .options(*RESPONSE_LOADERS)
        .where(*conditions)
        .order_by(Blog.published_at.desc(), Blog.created_at.desc(), Blog.id)
        .limit(limit)
        .offset(offset)
    )

    return list(result.scalars().all()), total or 0


async def get_blog(
    db: AsyncSession,
    blog_id: UUID,
    *,
    include_unpublished: bool = False,
) -> Blog | None:
    """One article by id. Used by the edit form, which must not depend on a slug.

    Visibility is a condition inside the query rather than a check afterwards,
    so a draft is genuinely not found. The router can answer 404 without having
    to choose between "missing" and "hidden" - and answering 403 would confirm
    the article exists, turning guessed ids into a working existence oracle.
    """
    conditions = [Blog.id == blog_id]

    if not include_unpublished:
        conditions.append(Blog.published.is_(True))

    result = await db.execute(select(Blog).options(*RESPONSE_LOADERS).where(*conditions))

    return result.scalar_one_or_none()


async def get_blog_by_slug(
    db: AsyncSession,
    slug: str,
    *,
    include_unpublished: bool = False,
) -> Blog | None:
    """One article by slug. The canonical public read.

    RENAME REDIRECT SEAM. A slug is frozen once published, so a published URL
    keeps working - but an article renamed while it was still a draft, or one
    whose slug an admin corrects after the fact, leaves the old address dead.

    The fix is a blog_redirects table mapping old_slug to blog id, and it plugs
    in here: when this returns None, look the slug up there and answer 301
    instead of 404. Nothing else in the module changes.
    """
    conditions = [Blog.slug == slug]

    if not include_unpublished:
        conditions.append(Blog.published.is_(True))

    result = await db.execute(select(Blog).options(*RESPONSE_LOADERS).where(*conditions))

    return result.scalar_one_or_none()


async def create_blog(
    db: AsyncSession,
    payload: BlogCreate,
    *,
    creator_id: UUID,
) -> Blog:
    """Store a new article, attributed to the caller.

    creator_id is a parameter rather than a field on the payload because the
    author comes from the verified session. The schema cannot carry it, so no
    request can claim it.
    """
    values = _clean(payload.model_dump())

    requested_slug = values.pop("slug")

    _assert_publishable(
        published=values["published"],
        content=values["content"],
        excerpt=values["excerpt"],
    )

    # First publish sets the date. Skipped when the payload named one, which is
    # how an article imported from an old site keeps its real date.
    if values["published"] and values["published_at"] is None:
        values["published_at"] = datetime.now(timezone.utc)

    if requested_slug is not None:
        # A specific request, so it is honoured or refused - never quietly
        # turned into something else. An official who asked for /blog/defi-101
        # and silently got /blog/defi-101-2 would only find out by reading the
        # response carefully.
        if await _slug_is_taken(db, requested_slug):
            raise SlugAlreadyExists(f"The slug '{requested_slug}' is already in use")

    # Normalised once. slugify returns "" for a title with no ASCII in it at
    # all - written entirely in Chinese, or in emoji - and everything below
    # assumes a usable base.
    base = slug_service.slugify(values["title"]) or slug_service.fallback_slug(uuid4().hex[:8])

    for attempt in range(INSERT_ATTEMPTS):
        if requested_slug is not None:
            slug = requested_slug
        elif attempt == 0:
            slug = await _free_slug(db, base)
        else:
            # A RETRY MUST NOT WALK TO THE NEXT NUMBER.
            #
            # Reaching here means a simultaneous request took the slug this one
            # had just confirmed was free. Every loser of that race would then
            # compute the same next candidate, race again, and lose again in
            # lockstep - six concurrent creates of one title produced two hard
            # failures before this branch existed, because the bound ran out
            # before the collisions did.
            #
            # A random token cannot collide with another request's guess, so
            # one retry settles it no matter how many writers there are. The
            # cost is a slug like race-condition-a3f91c2d instead of
            # race-condition-2, and only for the losers of a genuine race.
            slug = slug_service.with_token(base, uuid4().hex[:8])

        blog = Blog(**values, slug=slug, creator_id=creator_id)
        db.add(blog)

        try:
            await db.commit()
        except IntegrityError as error:
            await db.rollback()

            if integrity_constraint(error) != SLUG_CONSTRAINT:
                raise

            # The check above lost a race with a simultaneous request. The
            # database caught what application code could not.
            if requested_slug is not None:
                raise SlugAlreadyExists(
                    f"The slug '{requested_slug}' is already in use"
                ) from error

            logger.info("Slug %s taken mid-insert, retrying (%d)", slug, attempt + 1)
            continue

        logger.info("Blog %s created by user %s with slug %s", blog.id, creator_id, blog.slug)

        return await refresh_for_response(db, blog, RESPONSE_FIELDS)

    # Three derived slugs lost three races. Something is wrong beyond bad luck.
    raise SlugAlreadyExists("Could not find a free slug for this title")


async def update_blog(db: AsyncSession, blog: Blog, payload: BlogUpdate) -> Blog:
    """Apply a partial update to an article the router has already loaded."""
    # exclude_unset is what separates "leave the excerpt alone" from "clear the
    # excerpt". Both arrive as None; only the second one lands in this dict.
    changes = _clean(payload.model_dump(exclude_unset=True))

    was_published = blog.published
    will_be_published = changes.get("published", blog.published)

    # Judged against the row as it will exist, not as the payload describes it.
    # A PATCH carrying only published=true gives a schema nothing to look at;
    # here both halves are in reach.
    _assert_publishable(
        published=will_be_published,
        content=changes.get("content", blog.content),
        excerpt=changes.get("excerpt", blog.excerpt),
    )

    if "slug" in changes and changes["slug"] != blog.slug:
        # Frozen once published. A published URL is in a search index, a pinned
        # message, somebody's bookmarks - changing it breaks every one of them
        # with no way to notify anyone, and without a redirect it 404s.
        #
        # Checked against the STORED published flag, not the incoming one: an
        # article being published in this same request has not been public yet,
        # so its URL is still nobody's.
        if was_published:
            raise PublishedSlugImmutable(
                "The address of a published article cannot be changed. "
                "Unpublish it first if the URL is genuinely wrong."
            )

        if await _slug_is_taken(db, changes["slug"], excluding_id=blog.id):
            raise SlugAlreadyExists(f"The slug '{changes['slug']}' is already in use")

    # A slug is never re-derived from a changed title. Renaming a draft would
    # otherwise silently move it, and an official who chose a custom slug would
    # lose it the next time they fixed a typo in the headline. The form derives
    # a suggestion while the article is a draft and sends it explicitly, so the
    # author can see the URL they are getting.

    # Set once, on the first false to true transition, and never touched again.
    # Resetting on every publish would mean the routine cycle - unpublish, fix
    # a typo, republish - silently rewrites the publication date and reshuffles
    # the public list.
    if (
        will_be_published
        and not was_published
        and blog.published_at is None
        and "published_at" not in changes
    ):
        changes["published_at"] = datetime.now(timezone.utc)

    for field, value in changes.items():
        setattr(blog, field, value)

    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()

        if integrity_constraint(error) == SLUG_CONSTRAINT:
            raise SlugAlreadyExists(
                f"The slug '{changes.get('slug')}' is already in use"
            ) from error

        raise

    logger.info("Blog %s updated, fields: %s", blog.id, sorted(changes))

    return await refresh_for_response(db, blog, RESPONSE_FIELDS)


async def delete_blog(db: AsyncSession, blog: Blog) -> None:
    """Remove an article permanently.

    A hard delete, matching events and posts: the planned Activity Log records
    who deleted what, and soft deletion would put a deleted_at filter on every
    query this project ever writes, where forgetting it once quietly
    resurrects the row.

    The cover *file* is not removed - storage knows nothing about this
    transaction, so the object stays in the bucket until something goes and
    removes it. That cleanup belongs with the upload code, and does not exist
    yet. The key is logged so the gap is visible rather than silent.
    """
    blog_id = blog.id
    orphaned_key = blog.cover_image_key

    await db.delete(blog)
    await db.commit()

    logger.info("Blog %s deleted; unreferenced stored object: %s", blog_id, orphaned_key)
