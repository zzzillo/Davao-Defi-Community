import type { ReactNode } from 'react'
import { DemoAuthProvider } from '../auth/demoAuth'

/** Local demo session boundary, ready to be replaced with Clerk when the API is available. */
export default function ClerkWithRouter({ children }: { children: ReactNode }) {
  return <DemoAuthProvider>{children}</DemoAuthProvider>
}
