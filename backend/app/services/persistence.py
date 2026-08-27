"""Session handling that every service needs and none of them owns.

Two functions, both about the gap between "the ORM object in memory" and "the
row the database actually holds". They were written inside event_service, copied
into post_service, and would have been copied a third time into blog_service -
which is the point where a shared home stops being indirection and starts
paying for itself.

Named for what it is rather than what it serves. It is not a *_service module:
those own a table and a set of business rules, and this owns neither.
"""

from typing import TypeVar

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

# Bound to nothing in particular: any mapped instance works. Declared so the
# return type is the caller's model rather than a vague object, which is what
# lets `post = await refresh_for_response(db, post, [...])` keep its type.
ModelT = TypeVar("ModelT")


async def refresh_for_response(
    db: AsyncSession,
    instance: ModelT,
    fields: list[str],
) -> ModelT:
    """Reload what the database owns, so the row is safe to serialise.

    Two separate hazards, one fix:

    - updated_at is produced by onupdate=now(), a SQL expression SQLAlchemy
      cannot evaluate, so it is left expired after a flush. Reading it then
      attempts lazy IO and raises MissingGreenlet under async.
    - a relationship resolves silently when its row already sits in the
      session's identity map, and raises MissingGreenlet when it does not.
      That makes it a bug which comes and goes depending on unrelated code
      elsewhere in the same request - the worst kind to chase.

    `fields` is explicit rather than defaulted, because the right list is the
    one the response schema reads, and only the calling service knows that.
    """
    await db.refresh(instance, fields)
    return instance


def integrity_constraint(error: IntegrityError) -> str | None:
    """The name of the constraint a failed write violated, if the driver said.

    Turns an opaque database error into a decision. "This insert failed" is
    not actionable; "this insert failed on uq_blogs_slug" means try another
    slug, and "on uq_posts_event_id" means answer 409.

    Deliberately defensive about the shape: this reaches into the driver's own
    error object, which is psycopg today and may not always be. A missing
    attribute means "unknown", and every caller re-raises rather than guessing
    at which rule was broken.

    Constraints are named explicitly in the models precisely so the strings
    this returns are stable enough to compare against.
    """
    diagnostic = getattr(error.orig, "diag", None)

    return getattr(diagnostic, "constraint_name", None)
