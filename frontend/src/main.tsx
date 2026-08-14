import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ClerkProvider } from '@clerk/react'

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

// Clerk navigates on its own after sign-in/sign-up. Without these it uses
// window.location and reloads the whole app, so hand it the router instead.
function ClerkWithRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <ClerkProvider
      publishableKey={clerkKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkWithRouter>
        <App />
      </ClerkWithRouter>
    </BrowserRouter>
  </StrictMode>,
)
