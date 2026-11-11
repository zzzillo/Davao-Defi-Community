import { Link, Navigate } from 'react-router-dom'
import { SignUp } from '@clerk/react'
import { useAppAuth } from '../../auth/useAppAuth'
import logo from '../../assets/brand/ddc-logo-horizontal-light.svg'

const appearance = {
  variables: {
    colorPrimary: '#e64c3c',
    colorText: '#17212b',
    colorTextSecondary: '#58616a',
    colorBackground: '#ffffff',
    borderRadius: '0.75rem',
  },
}

export default function SignUpPage() {
  const { appUser, error, isLoaded, isSignedIn, loading, refreshUser, signOut } = useAppAuth()

  if (isSignedIn && appUser) return <Navigate to="/admin" replace />

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-outline bg-surface-lowest p-8 shadow-float">
        <img src={logo} alt="Davao DeFi Community" className="mx-auto mb-8 h-10 w-auto" />
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted">Invitation only</p>
        <h1 className="mb-2 text-center text-xl font-bold text-on-surface">Join DDC</h1>
        <p className="mb-6 text-center text-sm text-on-surface-variant">Use the secure invitation link sent to your email to finish setting up your account.</p>
        {error?.reason === 'clerk_publishable_key_missing' ? (
          <p role="status" className="rounded-xl bg-surface-low p-4 text-sm leading-6 text-on-surface-variant">{error.message}</p>
        ) : isSignedIn && loading ? (
          <p className="py-6 text-center text-sm text-on-surface-variant">Checking your DDC account…</p>
        ) : isSignedIn && error ? (
          <div role="alert" className="rounded-xl bg-surface-low p-4 text-sm leading-6 text-on-surface-variant">
            <p>{error.message}</p>
            {error.retryable && <button type="button" onClick={() => void refreshUser()} className="mt-4 block font-semibold text-on-surface">Try again</button>}
            <button type="button" onClick={() => void signOut()} className="mt-4 block font-semibold text-on-surface">Sign out</button>
          </div>
        ) : !isLoaded ? (
          <p className="py-6 text-center text-sm text-on-surface-variant">Loading invitation flow…</p>
        ) : (
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            signInFallbackRedirectUrl="/admin"
            fallbackRedirectUrl="/admin"
            appearance={appearance}
          />
        )}
        <p className="mt-6 text-center text-sm text-on-surface-variant">
          Already have access? <Link to="/sign-in" className="font-semibold text-on-surface">Sign in</Link>
        </p>
      </section>
    </main>
  )
}
