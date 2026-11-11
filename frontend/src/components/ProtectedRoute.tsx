import { Navigate, Link, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import Icon from './Icon'
import { useAppAuth } from '../auth/useAppAuth'
import { canAccessModule, type AdminModule } from '../utils/roles'
import LoadingScreen from './LoadingScreen'

function AuthProblem() {
  const { appUser, error, loading, refreshUser, signOut } = useAppAuth()

  if (loading) {
    return <LoadingScreen />
  }

  const title = error?.reason === 'invitation_required'
    ? 'An invitation is required'
    : error?.reason === 'invitation_not_accepted'
      ? 'Accept your invitation first'
      : error?.reason === 'account_suspended'
        ? 'This account is suspended'
        : error?.reason === 'clerk_identity_deleted'
          ? 'This sign-in is no longer available'
          : 'Your application profile is not ready'

  return (
    <section className="mx-auto mt-12 max-w-xl rounded-2xl border border-outline bg-surface-lowest p-8 text-center shadow-sm">
      <Icon name="lock" className="text-4xl text-muted" />
      <h1 className="mt-4 text-xl font-semibold text-on-surface">{appUser ? 'Account access is unavailable' : title}</h1>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
        {error?.message ?? 'We could not confirm your application account.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => void refreshUser()}
          disabled={loading || !error?.retryable}
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-lg border border-outline px-4 py-2 text-sm font-semibold text-on-surface"
        >
          Sign out
        </button>
        <Link to="/" className="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant">Community site</Link>
      </div>
    </section>
  )
}

/** A user with any active database role may open /admin; module routes are scoped below. */
export default function ProtectedRoute() {
  const { isLoaded, isSignedIn, appUser, loading } = useAppAuth()

  if (!isLoaded) {
    return <LoadingScreen />
  }

  if (!isSignedIn) return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`} replace />
  if (loading || !appUser) return <AuthProblem />
  if (appUser.status !== 'active') return <AuthProblem />

  return <Outlet key={`${appUser.id}:${appUser.role}:${appUser.status}`} />
}

export function RequireAdminModule({ module, children }: { module: AdminModule; children: ReactNode }) {
  const { appUser } = useAppAuth()
  if (!appUser || !canAccessModule(appUser.role, module)) {
    return (
      <section className="mx-auto mt-12 max-w-xl rounded-2xl border border-outline bg-surface-lowest p-8 text-center">
        <Icon name="lock" className="text-4xl text-muted" />
        <h1 className="mt-4 text-xl font-semibold text-on-surface">This section is not available to your account</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">Your role does not include this module. Your account role is managed by the DDC administrators.</p>
        <Link to="/admin" className="mt-5 inline-flex rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface">Back to dashboard</Link>
      </section>
    )
  }
  return children
}
