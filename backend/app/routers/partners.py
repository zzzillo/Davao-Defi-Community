from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, require_permission
from app.auth.permissions import Permission
from app.database import get_db
from app.models.partner import Partner
from app.schemas.pagination import PaginationParams
from app.schemas.partner import (
    PartnerCreate,
    PartnerListResponse,
    PartnerResponse,
    PartnerUpdate,
)
from app.services.exceptions import PartnerNameExists

# Imported as a module rather than by name so calls read partner_service.create,
# which keeps the layer visible at every call site - and stops the service
# functions from colliding with the route handlers, which want the same names.
from app.services import partner_service

router = APIRouter(
    prefix="/partners",
    tags=["Partners"],
)


async def _get_for_editing(db: AsyncSession, partner_id: UUID) -> Partner:
    """Load a partner for a caller who has already passed a permission gate."""
    partner = await partner_service.get_partner(db, partner_id)

    if partner is None:
        raise HTTPException(status_code=404, detail="Partner not found")

    return partner


def _name_conflict(error: PartnerNameExists) -> HTTPException:
    """409, because the request is fine and the world disagrees with it.

    Not 422: nothing about the body is malformed. The name is well formed, and
    the same request would have worked before that partner was listed. The
    frontend reacts differently to the two - a conflict means "you already have
    this one", which is not a spelling mistake to highlight.
    """
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"reason": "partner_name_taken", "message": str(error)},
    )


@router.get("", response_model=PartnerListResponse)
async def list_partners(
    search: str | None = Query(None, max_length=100),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """The partners list, serving the public page and the officials' table both.

    NO AUTH DEPENDENCY AT ALL, which is the visible difference from the other
    three list routes. Those take an optional user solely to decide whether the
    include_drafts flag is allowed. Partners have no drafts, so there is no
    flag, no gate, and nothing for a route to forget to check.
    """
    items, total = await partner_service.list_partners(
        db,
        search=search,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    return PartnerListResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get("/{partner_id}", response_model=PartnerResponse)
async def get_partner(
    partner_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """One partner. What the officials' edit form loads.

    Public, like the list, because there is nothing here a visitor could not
    already read off the public grid. It exists for the edit form: a refresh on
    /admin/partners/edit/<id> has to work, and a form that can only get its
    data from router state dies on reload.
    """
    partner = await partner_service.get_partner(db, partner_id)

    if partner is None:
        raise HTTPException(status_code=404, detail="Partner not found")

    return partner


@router.post("", response_model=PartnerResponse, status_code=status.HTTP_201_CREATED)
async def create_partner(
    payload: PartnerCreate,
    _: CurrentUser = Depends(require_permission(Permission.PARTNERS_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Create a partner. Requires partners.create.

    One auth dependency, not two. The other three creates also pull in
    get_current_db_user, because they store who wrote the row; a partner has no
    creator column, so the caller's local UUID is never needed and that SELECT
    never happens.
    """
    try:
        return await partner_service.create_partner(db, payload)
    except PartnerNameExists as error:
        raise _name_conflict(error) from error


@router.patch("/{partner_id}", response_model=PartnerResponse)
async def update_partner(
    partner_id: UUID,
    payload: PartnerUpdate,
    _: CurrentUser = Depends(require_permission(Permission.PARTNERS_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """Edit a partner. Any official holding partners.update may edit any one.

    No ownership hook here, unlike the other three. Those carry a note about
    restricting edits to the author; a partner has no author, so "only the
    person who added it may change it" is not a rule that could be written.
    """
    partner = await _get_for_editing(db, partner_id)

    try:
        return await partner_service.update_partner(db, partner, payload)
    except PartnerNameExists as error:
        raise _name_conflict(error) from error


@router.delete("/{partner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_partner(
    partner_id: UUID,
    _: CurrentUser = Depends(require_permission(Permission.PARTNERS_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Delete a partner permanently. Returns no body - 204 says it plainly.

    The logo file is not removed; storage knows nothing about this transaction.
    The service logs the key it orphaned so the gap is visible rather than
    silent, and clearing it belongs with the upload code.
    """
    partner = await _get_for_editing(db, partner_id)

    await partner_service.delete_partner(db, partner)
