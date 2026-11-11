import type { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/react'
import { useNavigate } from 'react-router-dom'
import { AppAuthProvider, AuthUnavailableProvider } from '../auth/appAuth'
import ResourceRealtimeBridge from './ResourceRealtimeBridge'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

/** Keep Clerk redirects inside the existing React Router history. */
export default function ClerkWithRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  if (!publishableKey) {
    // The public site still works without Clerk configuration. Auth pages show
    // an explicit setup message, and no local/demo identity is fabricated.
    return (
      <AuthUnavailableProvider>
        <ResourceRealtimeBridge />
        {children}
      </AuthUnavailableProvider>
    )
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/admin"
      signUpFallbackRedirectUrl="/admin"
      localization={{
        signIn: {
          start: {
            title: 'Welcome back',
            titleCombined: 'Welcome back',
            subtitle: 'Member access is by invitation only.',
            subtitleCombined: 'Member access is by invitation only.',
          },
        },
      }}
    >
      <AppAuthProvider>
        <ResourceRealtimeBridge />
        {children}
      </AppAuthProvider>
    </ClerkProvider>
  )
}
