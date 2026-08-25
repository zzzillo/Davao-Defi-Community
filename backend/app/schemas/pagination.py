"""One page shape for every list endpoint.

Events, Posts, and the admin user table all answer the same question - "here is
a slice, and here is how much there was" - so they answer it in one shape. A
frontend that can render one paged list can render all of them, and the next
module gets paging for free instead of inventing a fourth variation.
"""

from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, computed_field

ItemT = TypeVar("ItemT")

DEFAULT_LIMIT = 20

# A ceiling rather than a suggestion. Without one, a caller can ask for every
# row in the table and turn a paged endpoint into a full table scan that also
# has to be serialised.
MAX_LIMIT = 100


class PaginationParams:
    """The `limit` and `offset` query parameters, declared once.

    A dependency rather than two arguments copied into every list route, so the
    caps live in one place and cannot drift apart between modules.

    Used as: pagination: PaginationParams = Depends()
    """

    def __init__(
        self,
        limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
        offset: int = Query(0, ge=0),
    ):
        self.limit = limit
        self.offset = offset


class Page(BaseModel, Generic[ItemT]):
    """A slice of results, plus what a pager needs to draw itself.

    Generic, so Page[EventResponse] and Page[PostResponse] are two concrete
    models with one definition. FastAPI reads the parameter and documents the
    real item type in OpenAPI rather than a vague object.

    items and total came first and are what existing clients read; limit,
    offset, page and has_next were added around them. Adding fields to a
    response never breaks a reader, which is why this could replace the older
    shape without touching any frontend code.
    """

    items: list[ItemT]

    # Matches before paging, not the number returned. This is what "showing
    # 1-20 of 57" needs, and a bare list could never provide it.
    total: int

    limit: int
    offset: int

    @computed_field
    @property
    def has_next(self) -> bool:
        """Whether asking for the next slice would return anything.

        Counted from what was actually returned rather than from `limit`, so a
        short final page is reported honestly even if the service returned
        fewer rows than asked for.
        """
        return self.offset + len(self.items) < self.total

    @computed_field
    @property
    def page(self) -> int:
        """The 1-based page number, for rendering "Page 3 of 5".

        Derived rather than accepted as input: offset is the contract because
        it is strictly more flexible. This is exact whenever the offset came
        from a pager - that is, whenever it is a multiple of limit - and rounds
        down for a hand-written offset in between.
        """
        return self.offset // self.limit + 1 if self.limit else 1
