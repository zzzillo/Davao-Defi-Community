from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    CurrentUser,
    assert_may_see_drafts,
    get_current_db_user,
    get_optional_user,
    require_permission,
)
from app.auth.permissions import Permission
from app.database import get_db
from app.models.blog import Blog
from app.models.user import User
from app.schemas.blog import (
    BlogCreate,
    BlogListResponse,
    BlogResponse,
    BlogUpdate,
)
from app.schemas.pagination import PaginationParams
from app.services.exceptions import (
    PublishedBlogNeedsBody,
    PublishedSlugImmutable,
    SlugAlreadyExists,
)

# Imported as a module rather than by name so calls read blog_service.create,
# which keeps the layer visible at every call site - and stops the service
# functions from colliding with the route handlers, which want the same names.
from app.models.activity_log import ActivityAction, ActivityResource
from app.services import activity_log_service, blog_service

router = APIRouter(
    prefix="/blogs",
    tags=["Blogs"],
)


async def _get_for_editing(db: AsyncSession, blog_id: UUID) -> Blog:
    """Load an article for a caller who has already passed a permission gate.

    include_unpublished is True because drafts are hidden from the public, not
    from the people who write them. Every caller of this helper sits behind a
    require_permission dependency, so reaching here already means "allowed".
    """
    blog = await blog_service.get_blog(db, blog_id, include_unpublished=True)

    if blog is None:
        raise HTTPException(status_code=404, detail="Blog not found")

    return blog


def _blog_details(blog: Blog) -> dict:
    """What makes an article's log line readable.

    The slug travels alongside the title because it is the address the article
    lives at, and an admin reading "published Blog" wants to know which URL
    just went public - especially since a slug freezes at that moment.
    """
    return {"title": blog.title, "slug": blog.slug}


def _slug_conflict(error: SlugAlreadyExists) -> HTTPException:
    """409, because the request is fine and the world disagrees with it.

    Not 422: nothing about the body is malformed. The slug is well formed, and
    the same request would have worked a moment earlier. That is what conflict
    means, and the frontend reacts differently to it - suggesting a different
    address rather than telling the author their slug is invalid.
    """
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"reason": "slug_taken", "message": str(error)},
    )


@router.get("", response_model=BlogListResponse)
async def list_blogs(
    search: str | None = Query(None, max_length=100),
    creator_id: UUID | None = None,
    include_drafts: bool = Query(
        False, description="Include unpublished articles. Requires blogs.read."
    ),
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """The articles list, serving the public page and the officials' table both.

    Anonymous callers are welcome; they simply see published articles. The one
    thing that needs permission is include_drafts, which is the entire job of
    the blogs.read permission.

    Returns BlogSummaryResponse items - no article bodies. See schemas/blog.py:
    twenty articles at the hundred-thousand-character cap would be two
    megabytes of markup to render a grid of cards that shows a title, an
    excerpt and a picture.
    """
    if include_drafts:
        assert_may_see_drafts(current_user, Permission.BLOGS_READ, noun="articles")

    items, total = await blog_service.list_blogs(
        db,
        search=search,
        include_unpublished=include_drafts,
        creator_id=creator_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    return BlogListResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


# Declared before /{blog_id} on purpose. FastAPI matches routes in the order
# they are registered, and "slug" is a valid path segment - registered the other
# way round, a request for /blogs/slug/understanding-web3 would be handed to the
# UUID route, which would reject "slug" as a malformed UUID and answer 422.
@router.get("/slug/{slug}", response_model=BlogResponse)
async def get_blog_by_slug(
    slug: str = Path(max_length=220),
    current_user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """One article by its public address. The canonical read for a reader.

    Two routes rather than one that guesses. The obvious alternative - a single
    /blogs/{identifier} that tries a UUID parse and falls back to a slug - is
    implicit, cannot be documented honestly in OpenAPI, and quietly changes
    meaning the day somebody names an article after a UUID.

    404 rather than 403 for a hidden draft, deliberately. A 403 would confirm
    an article with this slug exists, which turns guessed addresses into a
    working existence oracle.
    """
    may_see_drafts = current_user is not None and current_user.can(Permission.BLOGS_READ)

    blog = await blog_service.get_blog_by_slug(db, slug, include_unpublished=may_see_drafts)

    if blog is None:
        raise HTTPException(status_code=404, detail="Blog not found")

    return blog


@router.get("/{blog_id}", response_model=BlogResponse)
async def get_blog(
    blog_id: UUID,
    current_user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """One article by id. What the edit form loads.

    By id rather than slug because a draft's slug can still change, and an
    edit URL that moves when the author renames the article is an edit URL that
    breaks mid-edit.
    """
    may_see_drafts = current_user is not None and current_user.can(Permission.BLOGS_READ)

    blog = await blog_service.get_blog(db, blog_id, include_unpublished=may_see_drafts)

    if blog is None:
        raise HTTPException(status_code=404, detail="Blog not found")

    return blog


@router.post("", response_model=BlogResponse, status_code=status.HTTP_201_CREATED)
async def create_blog(
    payload: BlogCreate,
    _: CurrentUser = Depends(require_permission(Permission.BLOGS_CREATE)),
    author: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an article, attributed to the caller.

    Two auth dependencies, one token verification: FastAPI caches a dependency's
    result within a request, and both of these resolve through get_current_user.
    The gate answers "may you?", the second answers "who are you, in our tables?"

    The author is never read from the body. BlogCreate has no field for it.
    """
    try:
        blog = await blog_service.create_blog(db, payload, creator_id=author.id)
    except SlugAlreadyExists as error:
        raise _slug_conflict(error) from error
    except PublishedBlogNeedsBody as error:
        # 422: the body is what is wrong. Publishing was asked for and the
        # article has nothing in it to publish.
        raise HTTPException(
            status_code=422,
            detail={"reason": "body_required", "message": str(error)},
        ) from error

    # An article can be born published, so even a create asks the question.
    await activity_log_service.log_activity(
        db,
        user_id=author.id,
        action=(ActivityAction.PUBLISHED if blog.published else ActivityAction.CREATED),
        resource=ActivityResource.BLOG,
        resource_id=blog.id,
        details=_blog_details(blog),
    )

    return blog


@router.patch("/{blog_id}", response_model=BlogResponse)
async def update_blog(
    blog_id: UUID,
    payload: BlogUpdate,
    _: CurrentUser = Depends(require_permission(Permission.BLOGS_UPDATE)),
    # Present only so the log knows who acted; see the note in events.py.
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit an article. Any official holding blogs.update may edit any article.

    OWNERSHIP HOOK - to restrict editing to the author instead, add
    `author: User = Depends(get_current_db_user)` to this signature and, for a
    non-admin caller, 403 when blog.creator_id != author.id. Same block in
    delete_blog. Nothing else changes.
    """
    blog = await _get_for_editing(db, blog_id)

    # Read before the service runs, because the service mutates this same
    # object - afterwards there is no "before" left to compare against.
    was_published = blog.published

    try:
        updated = await blog_service.update_blog(db, blog, payload)
    except SlugAlreadyExists as error:
        raise _slug_conflict(error) from error
    except PublishedSlugImmutable as error:
        # 409 rather than 422, and the distinction matters to the frontend.
        # The slug sent is perfectly valid; what refuses it is the article's
        # current state. Unpublishing would make the identical request succeed,
        # so the UI can offer that instead of highlighting a field as wrong.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"reason": "slug_frozen", "message": str(error)},
        ) from error
    except PublishedBlogNeedsBody as error:
        # A domain error becoming an HTTP one, at the only layer that knows
        # about both. The service stays usable from a script that has no
        # concept of a status code.
        raise HTTPException(
            status_code=422,
            detail={"reason": "body_required", "message": str(error)},
        ) from error

    await activity_log_service.log_activity(
        db,
        user_id=actor.id,
        action=activity_log_service.publish_action(was_published, updated.published),
        resource=ActivityResource.BLOG,
        resource_id=updated.id,
        details=_blog_details(updated),
    )

    return updated


@router.delete("/{blog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blog(
    blog_id: UUID,
    _: CurrentUser = Depends(require_permission(Permission.BLOGS_DELETE)),
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an article permanently. Returns no body - 204 says it plainly.

    The cover file is not removed; storage knows nothing about this
    transaction. The service logs the key it orphaned so the gap is visible
    rather than silent, and clearing it belongs with the upload code.
    """
    blog = await _get_for_editing(db, blog_id)

    # Captured before the delete; see the longer note in events.py.
    details = _blog_details(blog)
    deleted_id = blog.id

    await blog_service.delete_blog(db, blog)

    await activity_log_service.log_activity(
        db,
        user_id=actor.id,
        action=ActivityAction.DELETED,
        resource=ActivityResource.BLOG,
        resource_id=deleted_id,
        details=details,
    )
