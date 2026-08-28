"""The vocabulary of authorization: who someone is, and what they may do.

Deliberately free of FastAPI and SQLAlchemy imports. Everything here is plain
data plus pure functions, so the rules can be read - and tested - without a
request or a database session in play.
"""

from collections.abc import Iterable
from enum import StrEnum


class Role(StrEnum):
    """A person's rank. Exactly one per user, stored in Clerk publicMetadata."""

    MEMBER = "member"
    OFFICIAL = "official"
    ADMIN = "admin"


class Permission(StrEnum):
    """One specific thing an official is allowed to do.

    Named "<resource>.<action>" so the admin UI can group them by splitting on
    the dot instead of maintaining a separate lookup table.
    """

    EVENTS_READ = "events.read"
    EVENTS_CREATE = "events.create"
    EVENTS_UPDATE = "events.update"
    EVENTS_DELETE = "events.delete"

    POSTS_READ = "posts.read"
    POSTS_CREATE = "posts.create"
    POSTS_UPDATE = "posts.update"
    POSTS_DELETE = "posts.delete"

    BLOGS_READ = "blogs.read"
    BLOGS_CREATE = "blogs.create"
    BLOGS_UPDATE = "blogs.update"
    BLOGS_DELETE = "blogs.delete"

    # Deliberately unused, and kept rather than removed.
    #
    # In every other module the read permission has exactly one job: gating the
    # include_drafts flag on a list route. Partners have no draft state, so
    # there is nothing to hide and nothing for this to guard - GET /partners
    # takes no auth dependency at all.
    #
    # Kept because it costs nothing, because a role's stored permission list in
    # Clerk may already contain the string, and because it is what a future
    # hidden-partner state would use. Documented here so the next reader knows
    # it was decided rather than forgotten.
    PARTNERS_READ = "partners.read"
    PARTNERS_CREATE = "partners.create"
    PARTNERS_UPDATE = "partners.update"
    PARTNERS_DELETE = "partners.delete"

    USERS_READ = "users.read"
    USERS_UPDATE = "users.update"

    ACTIVITY_LOGS_READ = "activity_logs.read"


# Ranked lowest to highest. Gates compare rank, so "official or above" is one
# comparison rather than a set of roles that has to be updated in every gate the
# day a fourth role appears.
_ROLE_RANK: dict[Role, int] = {
    Role.MEMBER: 0,
    Role.OFFICIAL: 1,
    Role.ADMIN: 2,
}


def role_at_least(role: Role, minimum: Role) -> bool:
    """True when `role` sits at or above `minimum` in the hierarchy."""
    return _ROLE_RANK[role] >= _ROLE_RANK[minimum]


def parse_role(raw: object) -> Role:
    """Turn whatever publicMetadata holds into a Role we can trust.

    Missing, misspelled, or hand-edited in the Clerk Dashboard - it all becomes
    MEMBER. Authorization has to fail closed: a role we cannot read must mean
    least privilege, never most.
    """
    try:
        return Role(raw)
    except ValueError:
        return Role.MEMBER


def parse_permissions(raw: object) -> frozenset[Permission]:
    """Turn a raw metadata list into known permissions, dropping the rest.

    Unrecognised strings are ignored rather than rejected. A permission no
    endpoint checks is inert anyway, and silently dropping it means renaming a
    permission cannot lock anybody out mid-deploy.
    """
    if not isinstance(raw, list):
        return frozenset()

    known = []
    for item in raw:
        try:
            known.append(Permission(item))
        except ValueError:
            continue

    return frozenset(known)


def has_permission(
    role: Role,
    permissions: Iterable[Permission],
    required: Permission,
) -> bool:
    """The single question the whole system asks: may this person do `required`?"""
    if role is Role.ADMIN:
        # Admin implies everything, so no "*" wildcard is ever stored on a row.
        return True

    if role is Role.MEMBER:
        # A leftover permission list on a demoted user must not keep working.
        return False

    return required in set(permissions)
