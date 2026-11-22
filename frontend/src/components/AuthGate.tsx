import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { SignedOutAuthProvider } from '../auth/signedOutAuth'
import LoadingScreen from './LoadingScreen'
import ResourceRealtimeBridge from './ResourceRealtimeBridge'

const ClerkWithRouter = lazy(() => import('./ClerkWithRouter'))

const AUTH_PATH = /^\/(admin|sign-in|sign-up|reset-password)(\/|$)/

function needsAuth(pathname: string): boolean {
  return AUTH_PATH.test(pathname)
}

/**
 * Loads Clerk only where a session is used.
 *
 * Public pages render with a signed-out context, so visitors never download
 * @clerk/react or the clerk-js script. The first visit to the admin or an auth
 * page in this tab mounts Clerk, and it stays mounted from then on, so moving
 * back to a public page never tears down a signed-in session.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [clerkMounted, setClerkMounted] = useState(() => needsAuth(pathname))

  // Derived during render rather than in an effect, so the first render of an
  // auth route already has Clerk instead of flashing a signed-out state.
  if (!clerkMounted && needsAuth(pathname)) setClerkMounted(true)

  if (clerkMounted) {
    return (
      <Suspense fallback={pathname.startsWith('/admin') ? <LoadingScreen /> : null}>
        <ClerkWithRouter>{children}</ClerkWithRouter>
      </Suspense>
    )
  }

  return (
    <SignedOutAuthProvider>
      <ResourceRealtimeBridge />
      {children}
    </SignedOutAuthProvider>
  )
}
