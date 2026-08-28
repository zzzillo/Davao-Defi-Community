from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from app.models.post import Post
from app.models.user import User
from app.schemas.pagination import PaginationParams
from app.schemas.post import (
    PostCreate,
    PostListResponse,
    PostResponse,
    PostUpdate,
)
from app.services.exceptions import (
    LinkedEventNotFound,
    PublishedPostNeedsImage,
    RecapAlreadyExists,
)

# Imported as a module rather than by name so calls read post_service.create,
# which keeps the layer visible at every call site - and stops the service
# functions from colliding with the route handlers, which want the same names.
from app.models.activity_log import ActivityAction, ActivityResource
from app.services import activity_log_service, post_service

router = APIRouter(
    prefix="/posts",
    tags=["Posts"],
)


async def _get_for_editing(db: AsyncSession, post_id: UUID) -> Post:
    """Load a post for a caller who has already passed a permission gate.

    include_unpublished is True because drafts are hidden from the public, not
    from the people who write them. Every caller of this helper sits behind a
    require_permission dependency, so reaching here already means "allowed".
    """
    post = await post_service.get_post(db, post_id, include_unpublished=True)

    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    return post


def _post_details(post: Post) -> dict:
    """What makes a post's log line readable.

    A post title is optional - the schema allows it to be null - so the log
    falls back to the event being recapped, and then to nothing. Writing
    {"title": None} instead would put a line in the trail that reads "created
    Post" and identifies nothing.
    """
    if post.title:
        return {"title": post.title}

    if post.event:
        return {"event_title": post.event.title}

    return {}


def _recap_conflict(error: RecapAlreadyExists) -> HTTPException:
    """409, because the request is fine and the world disagrees with it.

    Not 422: nothing about the body is malformed. The event genuinely exists,
    the payload is valid, and it would have worked a moment earlier. That is
    what conflict means, and the frontend reacts differently to it - offering
    to open the existing recap rather than highlighting a field.
    """
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"reason": "recap_already_exists", "message": str(error)},
    )


@router.get("", response_model=PostListResponse)
async def list_posts(
    search: str | None = Query(None, max_length=100),
    event_id: UUID | None = Query(
        None, description="Only the recap of this event, if one exists"
    ),
    creator_id: UUID | None = None,
    include_drafts: bool = Query(
        False, description="Include unpublished posts. Requires posts.read."
    ),
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """The posts list, serving the public gallery and the officials' table both.

    Anonymous callers are welcome; they simply see published posts. The one
    thing that needs permission is include_drafts, which is the entire job of
    the posts.read permission.
    """
    if include_drafts:
        assert_may_see_drafts(current_user, Permission.POSTS_READ, noun="posts")

    items, total = await post_service.list_posts(
        db,
        search=search,
        include_unpublished=include_drafts,
        creator_id=creator_id,
        event_id=event_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    return PostListResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: UUID,
    current_user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """One post. A draft is visible only to somebody holding posts.read.

    404 rather than 403 for a hidden draft, deliberately. A 403 would confirm
    that a post with this id exists, which turns guessed ids into a working
    existence oracle.
    """
    may_see_drafts = current_user is not None and current_user.can(Permission.POSTS_READ)

    post = await post_service.get_post(db, post_id, include_unpublished=may_see_drafts)

    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    return post


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: PostCreate,
    _: CurrentUser = Depends(require_permission(Permission.POSTS_CREATE)),
    author: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a post, attributed to the caller.

    Two auth dependencies, one token verification: FastAPI caches a dependency's
    result within a request, and both of these resolve through get_current_user.
    The gate answers "may you?", the second answers "who are you, in our tables?"

    The author is never read from the body. PostCreate has no field for it.
    """
    try:
        post = await post_service.create_post(db, payload, creator_id=author.id)
    except RecapAlreadyExists as error:
        raise _recap_conflict(error) from error
    except LinkedEventNotFound as error:
        # 422, not 404: the URL is fine, the body named something that does not
        # exist. A 404 here would suggest /posts itself was wrong.
        raise HTTPException(
            status_code=422,
            detail={"reason": "event_not_found", "message": str(error)},
        ) from error

    # A post's title is optional, so the log falls back to the event it recaps.
    # "created Post" with nothing else is a line nobody can act on.
    await activity_log_service.log_activity(
        db,
        user_id=author.id,
        action=ActivityAction.CREATED,
        resource=ActivityResource.POST,
        resource_id=post.id,
        details=_post_details(post),
    )

    return post


@router.patch("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: UUID,
    payload: PostUpdate,
    _: CurrentUser = Depends(require_permission(Permission.POSTS_UPDATE)),
    # Present only so the log knows who acted; see the note in events.py.
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit a post. Any official holding posts.update may edit any post.

    OWNERSHIP HOOK - to restrict editing to the author instead, add
    `author: User = Depends(get_current_db_user)` to this signature and, for a
    non-admin caller, 403 when post.creator_id != author.id. Same block in
    delete_post. Nothing else changes.
    """
    post = await _get_for_editing(db, post_id)

    was_published = post.published

    try:
        updated = await post_service.update_post(db, post, payload)
    except RecapAlreadyExists as error:
        raise _recap_conflict(error) from error
    except LinkedEventNotFound as error:
        raise HTTPException(
            status_code=422,
            detail={"reason": "event_not_found", "message": str(error)},
        ) from error
    except PublishedPostNeedsImage as error:
        # A domain error becoming an HTTP one, at the only layer that knows
        # about both. The service stays usable from a script that has no
        # concept of a status code.
        raise HTTPException(
            status_code=422,
            detail={"reason": "images_required", "message": str(error)},
        ) from error

    # Publishing is a state change worth naming, not just another edit. An
    # admin scanning for "what went public today" should not have to open every
    # `updated` entry to find out. Compared against the value read before the
    # service ran, because the service mutates this same object.
    await activity_log_service.log_activity(
        db,
        user_id=actor.id,
        action=activity_log_service.publish_action(was_published, updated.published),
        resource=ActivityResource.POST,
        resource_id=updated.id,
        details=_post_details(updated),
    )

    return updated


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: UUID,
    _: CurrentUser = Depends(require_permission(Permission.POSTS_DELETE)),
    actor: User = Depends(get_current_db_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a post permanently. Returns no body - 204 says it plainly.

    The image rows go with it by ON DELETE CASCADE. The stored files do not;
    the service logs the keys it orphaned so the gap is visible rather than
    silent, and clearing them belongs with the upload code.
    """
    post = await _get_for_editing(db, post_id)

    # Captured before the delete - afterwards the instance is expired and there
    # is nothing left to name. See the longer note in events.py.
    details = _post_details(post)
    deleted_id = post.id

    await post_service.delete_post(db, post)

    await activity_log_service.log_activity(
        db,
        user_id=actor.id,
        action=ActivityAction.DELETED,
        resource=ActivityResource.POST,
        resource_id=deleted_id,
        details=details,
    )
