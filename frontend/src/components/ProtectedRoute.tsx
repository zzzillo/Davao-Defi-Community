import type { ReactNode } from 'react'
import { ClerkLoading, RedirectToSignIn, Show } from '@clerk/react'

// Show renders null while Clerk is still resolving the session, so the fallback
// never fires mid-load and bounces a signed-in user to /sign-in. ClerkLoading
// covers that gap so the officials pages don't flash blank on a hard refresh.
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  return (
    <>
      <ClerkLoading>
        <div className="flex h-full items-center justify-center text-on-surface-variant">
          Loading...
        </div>
      </ClerkLoading>

      <Show when="signed-in" fallback={<RedirectToSignIn />}>
        {children}
      </Show>
    </>
  )
}
