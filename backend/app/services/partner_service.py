"""Everything the application knows how to do with a partner.

Routers translate HTTP into these calls and their results back into HTTP.
Nothing in here imports FastAPI, and nothing in here checks permissions - that
belongs to the router, because identity arrives with the request.

Audit logging seam: every mutating function returns the affected Partner, and
the router is the layer holding current_user. When Activity Logs arrives, each
route gains one log_activity(...) line and nothing in this file changes.

The shortest service in the project, and worth noticing what is absent rather
than what is here. No sanitiser, because a partner has no authored text. No
eager loaders, because there are no relationships. No visibility conditions,
because there are no drafts. No slug resolution, no image reconciliation, no
publish rules. What remains is create, read, update, delete, plus one uniqueness
check - which is the whole module.
"""

import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner import Partner
from app.schemas.partner import PartnerCreate, PartnerUpdate
from app.services.exceptions import PartnerNameExists
from app.services.persistence import integrity_constraint, refresh_for_response

logger = logging.getLogger(__name__)

# The name Postgres gives the index behind "one partner per name". Matched
# against a failed write so that particular collision becomes a readable 409
# instead of an opaque driver exception. Declared explicitly in
# models/partner.py precisely so this string is stable.
NAME_INDEX = "uq_partners_name_lower"

# What the flush leaves expired - see services/persistence.py. Only the two
# timestamps: every other column was set by this process and no relationship
# exists to reload, which is why this list is shorter than any other module's.
RESPONSE_FIELDS = ["created_at", "updated_at"]


async def _name_is_taken(
    db: AsyncSession,
    name: str,
    *,
    excluding_id: UUID | None = None,
) -> bool:
    """Whether another partner already holds this name, ignoring case.

    lower() on both sides, matching the index exactly. Comparing the raw name
    here would let "nexus technologies" pass this check and then be refused by
    the database - which still ends in the right answer, but by way of an
    exception handler rather than a sentence explaining the problem.

    This is NOT what enforces the rule. Two simultaneous requests can both run
    it, both find nothing, and both insert; only the unique index is atomic.
    It exists for the error message, and create_partner catches the database's
    answer for the case where it loses that race.

    excluding_id lets a partner keep its own name during an update, instead of
    colliding with itself.
    """
    conditions = [func.lower(Partner.name) == name.lower()]

    if excluding_id is not None:
        conditions.append(Partner.id != excluding_id)

    return await db.scalar(select(Partner.id).where(*conditions)) is not None


async def list_partners(
    db: AsyncSession,
    *,
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Partner], int]:
    """A page of partners, plus how many matched before paging was applied.

    No include_unpublished parameter, unlike every other list in this project.
    Partners have no draft state, so there is nothing to hide and no way for a
    route to forget to hide it.

    Ordered alphabetically, ignoring case. A logo wall has no chronology -
    nobody looks for the most recently added sponsor - and a stable order means
    the grid does not reshuffle when somebody edits a name.

    lower() is not decoration. This database runs the C.UTF-8 collation, which
    sorts by byte value, so every uppercase letter sorts before every lowercase
    one: plain ORDER BY name puts "beta collective" AFTER "Zeta Labs", and any
    partner with a stylised lowercase name is exiled to the end of the grid.
    Folding case first sorts the way a person reading the wall expects.

    It also happens to match uq_partners_name_lower exactly, so the planner can
    walk that index instead of sorting - the same index that enforces
    uniqueness, doing a second job for free.

    id breaks ties, without which two partners differing only in case could
    swap places between pages: one shown twice, the other never.
    """
    conditions = []

    if search:
        # ilike is case-insensitive LIKE. The term is a bound parameter, so it
        # stays data rather than SQL no matter what the visitor typed.
        conditions.append(Partner.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(Partner).where(*conditions))

    result = await db.execute(
        select(Partner)
        .where(*conditions)
        .order_by(func.lower(Partner.name), Partner.id)
        .limit(limit)
        .offset(offset)
    )

    return list(result.scalars().all()), total or 0


async def get_partner(db: AsyncSession, partner_id: UUID) -> Partner | None:
    """One partner, or None when it does not exist.

    No include_unpublished, and no 404-instead-of-403 reasoning to apply. The
    careful visibility dance in the other three services exists to stop a
    guessed id confirming that a draft exists; partners have no drafts, so
    every row here is public and "not found" means exactly that.
    """
    return await db.scalar(select(Partner).where(Partner.id == partner_id))


async def create_partner(db: AsyncSession, payload: PartnerCreate) -> Partner:
    """Store a new partner.

    No creator_id parameter, unlike the other three creates. A partner has no
    author to credit - see models/partner.py - and "who added this" is a
    question the planned Activity Log answers.
    """
    if await _name_is_taken(db, payload.name):
        raise PartnerNameExists(f"A partner named '{payload.name}' already exists")

    partner = Partner(**payload.model_dump())
    db.add(partner)

    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()

        # The check above lost a race with a simultaneous request. The database
        # caught what application code could not, and this turns its answer
        # back into the same error the check would have raised.
        if integrity_constraint(error) == NAME_INDEX:
            raise PartnerNameExists(
                f"A partner named '{payload.name}' already exists"
            ) from error

        raise

    logger.info("Partner %s created: %s", partner.id, partner.name)

    return await refresh_for_response(db, partner, RESPONSE_FIELDS)


async def update_partner(
    db: AsyncSession,
    partner: Partner,
    payload: PartnerUpdate,
) -> Partner:
    """Apply a partial update to a partner the router has already loaded."""
    # exclude_unset is what separates "leave the logo alone" from "remove the
    # logo". Both arrive as None; only the second one lands in this dict.
    changes = payload.model_dump(exclude_unset=True)

    # Only when the name actually changes. Without that guard, saving a partner
    # after editing nothing but its logo would run a pointless query - and,
    # were excluding_id ever dropped, would refuse the partner's own name.
    if "name" in changes and changes["name"] != partner.name:
        if await _name_is_taken(db, changes["name"], excluding_id=partner.id):
            raise PartnerNameExists(
                f"A partner named '{changes['name']}' already exists"
            )

    for field, value in changes.items():
        setattr(partner, field, value)

    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()

        if integrity_constraint(error) == NAME_INDEX:
            raise PartnerNameExists(
                f"A partner named '{changes.get('name')}' already exists"
            ) from error

        raise

    logger.info("Partner %s updated, fields: %s", partner.id, sorted(changes))

    return await refresh_for_response(db, partner, RESPONSE_FIELDS)


async def delete_partner(db: AsyncSession, partner: Partner) -> None:
    """Remove a partner permanently.

    A hard delete, matching every other module: the planned Activity Log
    records who deleted what, and soft deletion would put a deleted_at filter
    on every query this project ever writes, where forgetting it once quietly
    resurrects the row.

    The logo *file* is not removed - storage knows nothing about this
    transaction, so the object stays in the bucket until something goes and
    removes it. That cleanup belongs with the upload code, and does not exist
    yet. The key is logged so the gap is visible rather than silent.
    """
    partner_id = partner.id
    orphaned_key = partner.logo_key

    await db.delete(partner)
    await db.commit()

    logger.info(
        "Partner %s deleted; unreferenced stored object: %s", partner_id, orphaned_key
    )
