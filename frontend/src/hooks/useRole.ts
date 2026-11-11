import { useAppAuth } from '../auth/useAppAuth'
import type { Role } from '../utils/roles'

export type UseRoleResult = {
  isLoaded: boolean
  isSignedIn: boolean
  /** Null until a corresponding active database user has loaded. */
  role: Role | null
  canOpenAdmin: boolean
}

/** Application roles are read only from the current backend user response. */
export function useRole(): UseRoleResult {
  const { isLoaded, isSignedIn, appUser } = useAppAuth()

  return {
    isLoaded,
    isSignedIn,
    role: appUser?.role ?? null,
    canOpenAdmin: Boolean(isSignedIn && appUser?.status === 'active'),
  }
}
