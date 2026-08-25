import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

/**
 * ClerkProvider, wired to the router.
 *
 * Clerk navigates on its own after sign-in and sign-up. Left alone it uses
 * window.location, which reloads the whole app and throws away every bit of
 * client state; handing it the router's navigate keeps the transition in-page.
 *
 * It lives in its own file because main.tsx exports nothing - it is the entry
 * point that calls createRoot. Fast Refresh can only hot-swap a module that
 * exports the component it is rendering, so a component declared inline there
 * costs a full page reload on every edit.
 */
export default function ClerkWithRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <ClerkProvider
      publishableKey={clerkKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  )
}
