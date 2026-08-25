/**
 * The frontend's copy of the role vocabulary.
 *
 * Mirrors backend/app/auth/permissions.py deliberately, and is only ever used
 * to decide what to *show*. Every rule that matters is enforced again on the
 * server, where the role is read from a signed token rather than from anything
 * a browser can reach.
 *
 * That distinction is the whole point of this file existing rather than the
 * pages asking Clerk directly: hiding a button is a courtesy, refusing the
 * request is the security. A member who edits their way past these checks
 * reaches an admin screen whose every action the API rejects - which is exactly
 * what should happen, and why this file can be wrong without being dangerous.
 *
 * Pure functions, no React: same input, same answer, testable on their own.
 */

export type Role = 'member' | 'official' | 'admin'

/** Ranked lowest to highest, so "official or above" is one comparison. */
const ROLE_RANK: Record<Role, number> = {
  member: 0,
  official: 1,
  admin: 2,
}

/**
 * Turn whatever Clerk's publicMetadata holds into a Role.
 *
 * Missing, misspelled, or hand-edited in the Clerk Dashboard all become
 * `member`. Authorization fails closed: a role that cannot be read must mean
 * least privilege, never most. Same rule as parse_role on the backend.
 */
export function parseRole(raw: unknown): Role {
  if (raw === 'official' || raw === 'admin' || raw === 'member') return raw

  return 'member'
}

/** True when `role` sits at or above `minimum`. */
export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}

/**
 * May this person open the admin app at all?
 *
 * A coarse gate on top of the fine-grained permissions the API checks per
 * route. Officials with a narrow permission set still get in and simply find
 * some actions refused; members do not get in at all, which spares them a
 * dashboard where every button fails.
 */
export function canOpenAdmin(role: Role): boolean {
  return roleAtLeast(role, 'official')
}
