import { Link, Navigate, Outlet } from 'react-router-dom'
import Icon from './Icon'
import { useRole } from '../hooks/useRole'

/**
 * The gate on the admin app.
 *
 * Two separate questions, and they deserve different answers:
 *
 * - Not signed in? Send them to sign in. They may well be an official who
 *   simply has no session yet.
 * - Signed in but not an official? Say so. A redirect would be a worse answer:
 *   they are already who they are going to be, and bouncing them somewhere
 *   without explanation reads as a broken link.
 *
 * This is presentation. Every route behind it is checked again by the API,
 * against the role in a signed token - so a member who forces their way to a
 * page here finds every request refused. Nothing is protected by this file
 * being correct; it exists so people are not shown a screen that cannot work.
 */
export default function ProtectedRoute() {
  const { isLoaded, isSignedIn, canOpenAdmin } = useRole()

  // isSignedIn is meaningless until isLoaded flips true, so guard on it first
  // or a hard refresh bounces a signed-in official straight back to /sign-in.
  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-on-surface-variant">
        Loading...
      </div>
    )
  }

  if (!isSignedIn) return <Navigate to="/sign-in" replace />

  if (!canOpenAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <Icon name="lock" className="text-[40px] text-muted" />
        <p className="text-lg font-semibold text-on-surface">Officials only</p>
        <p className="max-w-md text-sm text-on-surface-variant">
          Your account does not have access to the admin area. If that seems
          wrong, ask an admin to check your role.
        </p>
        <Link
          to="/events"
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Back to the community site
        </Link>
      </div>
    )
  }

  return <Outlet />
}
