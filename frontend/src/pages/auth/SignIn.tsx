import { Link, Navigate } from 'react-router-dom'
import { SignIn } from '@clerk/react'
import { useAppAuth } from '../../auth/useAppAuth'
import logo from '../../assets/brand/ddc-logo-horizontal-light.svg'

const appearance = {
  options: {
    elevation: 'flush' as const,
  },
  variables: {
    colorPrimary: '#e64c3c',
    colorText: '#17212b',
    colorTextSecondary: '#58616a',
    colorBackground: '#ffffff',
    borderRadius: '0.75rem',
  },
}

function AuthStatus({ title, message }: { title: string; message: string }) {
  const { loading, refreshUser, signOut, error, isSignedIn } = useAppAuth()
  return (
    <section className="w-full max-w-md rounded-2xl border border-outline bg-surface-lowest p-8 text-center shadow-float">
      <img src={logo} alt="Davao DeFi Community" className="mx-auto mb-8 h-10 w-auto" />
      <h1 className="text-xl font-bold text-on-surface">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{message}</p>
      {error?.retryable && (
        <button type="button" disabled={loading} onClick={() => void refreshUser()} className="mt-6 rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-50">
          Try again
        </button>
      )}
      {isSignedIn && <button type="button" onClick={() => void signOut()} className="mt-6 block w-full text-sm font-semibold text-on-surface-variant hover:text-on-surface">Sign out</button>}
      <Link to="/" className="mt-4 inline-block text-sm text-on-surface-variant hover:text-on-surface">Back to the community site</Link>
    </section>
  )
}

export default function SignInPage() {
  const { error, isLoaded, isSignedIn } = useAppAuth()

  if (isLoaded && isSignedIn) return <Navigate to="/admin" replace />

  if (error?.reason === 'clerk_publishable_key_missing') {
    return <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-10"><AuthStatus title="Sign-in is not configured" message={error.message} /></main>
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-surface px-5 pb-10 pt-20">
      <section className="w-full max-w-sm">
        <img src={logo} alt="Davao DeFi Community" className="mx-auto mb-8 h-10 w-auto" />
        {!isLoaded ? (
          <p className="py-6 text-center text-sm text-on-surface-variant">Loading sign-in…</p>
        ) : (
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            signUpFallbackRedirectUrl="/admin"
            fallbackRedirectUrl="/admin"
            appearance={appearance}
          />
        )}
      </section>
    </main>
  )
}
