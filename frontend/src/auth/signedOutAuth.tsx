import { useMemo, type ReactNode } from 'react'
import { AppAuthContext, type AppAuthValue } from './appAuthContext'

/**
 * Auth context for public pages, which never need a session.
 *
 * Deliberately free of any @clerk/react import: this file is in the bundle
 * every visitor downloads, and Clerk (plus the clerk-js script it fetches) is
 * only loaded once someone opens the admin or a sign-in page. See AuthGate.
 */
export function SignedOutAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AppAuthValue>(() => ({
    appUser: null,
    loading: false,
    error: null,
    isLoaded: true,
    isSignedIn: false,
    getToken: async () => null,
    refreshUser: async () => {},
    signOut: async () => {},
  }), [])
  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
}
