import { useUser } from '@clerk/react'
import { canOpenAdmin, parseRole } from '../utils/roles'
import type { Role } from '../utils/roles'

export type UseRoleResult = {
  /** False until Clerk has answered. Nothing below it means anything yet. */
  isLoaded: boolean
  isSignedIn: boolean
  /** `member` for anonymous visitors, so callers never handle a null role. */
  role: Role
  /** Whether to show the admin app to this person. */
  canOpenAdmin: boolean
}

/**
 * Who the current visitor is, in this app's own vocabulary.
 *
 * The role lives in Clerk's publicMetadata, which only the backend's secret key
 * can write - a user cannot promote themselves through the browser. The same
 * field rides inside the session token as the `metadata` claim, which is what
 * the API reads, so both sides are looking at one source of truth.
 *
 * Still only a display decision. See utils/roles.ts.
 */
export function useRole(): UseRoleResult {
  const { isLoaded, isSignedIn, user } = useUser()

  const role = parseRole(user?.publicMetadata?.role)

  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    role,
    // Signed out is not "not an official" - it is nobody, and nobody gets in.
    canOpenAdmin: Boolean(isSignedIn) && canOpenAdmin(role),
  }
}
