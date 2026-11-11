"""Database advisory locks shared by role changes and Clerk onboarding."""

# Stage 2's lock serializes role/status mutations and last-superadmin checks.
# Clerk identity/deletion sync and invitation acceptance use it as well so
# external lifecycle events cannot race an access change.
USER_MUTATION_LOCK_KEY = 783_421_091
