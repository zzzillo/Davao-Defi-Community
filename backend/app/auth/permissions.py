"""The vocabulary of authorization: who someone is, and what they may do.

Deliberately free of FastAPI and SQLAlchemy imports. Everything here is plain
data plus pure functions, so the rules can be read - and tested - without a
request or a database session in play.
"""

from enum import StrEnum


class Role(StrEnum):
    """A person's rank, stored on the application's user row."""

    MEMBER = "member"
    OFFICIAL = "official"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


class Permission(StrEnum):
    """Endpoint capability names used to map fixed role tiers to modules."""

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

    PARTNERS_READ = "partners.read"
    PARTNERS_CREATE = "partners.create"
    PARTNERS_UPDATE = "partners.update"
    PARTNERS_DELETE = "partners.delete"

    USERS_READ = "users.read"
    USERS_UPDATE = "users.update"

    ACTIVITY_LOGS_READ = "activity_logs.read"


# Ranked lowest to highest.
_ROLE_RANK: dict[Role, int] = {
    Role.MEMBER: 0,
    Role.OFFICIAL: 1,
    Role.ADMIN: 2,
    Role.SUPERADMIN: 3,
}


def role_at_least(role: Role, minimum: Role) -> bool:
    """True when `role` sits at or above `minimum` in the role hierarchy."""
    return _ROLE_RANK[role] >= _ROLE_RANK[minimum]


def is_role_demotion(previous: Role, target: Role) -> bool:
    """Return whether a changed role moves strictly down the fixed hierarchy."""
    return previous is not target and role_at_least(previous, target)


def parse_role(raw: object) -> Role:
    """Turn the stored role into a known tier, failing closed on bad data.

    Missing, misspelled, or hand-edited in the Clerk Dashboard - it all becomes
    MEMBER. Authorization has to fail closed: a role we cannot read must mean
    least privilege, never most.
    """
    try:
        return Role(raw)
    except ValueError:
        return Role.MEMBER


_ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.MEMBER: frozenset({
            Permission.BLOGS_READ,
            Permission.BLOGS_CREATE,
            Permission.BLOGS_UPDATE,
            Permission.BLOGS_DELETE,
        }),
    Role.OFFICIAL: frozenset({
            Permission.BLOGS_READ,
            Permission.BLOGS_CREATE,
            Permission.BLOGS_UPDATE,
            Permission.BLOGS_DELETE,
            Permission.EVENTS_READ,
            Permission.EVENTS_CREATE,
            Permission.EVENTS_UPDATE,
            Permission.EVENTS_DELETE,
            Permission.POSTS_READ,
            Permission.POSTS_CREATE,
            Permission.POSTS_UPDATE,
            Permission.POSTS_DELETE,
            Permission.PARTNERS_READ,
            Permission.PARTNERS_CREATE,
            Permission.PARTNERS_UPDATE,
            Permission.PARTNERS_DELETE,
        }),
    Role.ADMIN: frozenset(Permission),
    Role.SUPERADMIN: frozenset(Permission),
}


def has_permission(role: Role, required: Permission) -> bool:
    """Check the fixed cumulative role map; permissions are never per-user."""
    return required in _ROLE_PERMISSIONS[role]
