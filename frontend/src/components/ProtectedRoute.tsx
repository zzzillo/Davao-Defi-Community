import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@clerk/react'

// isSignedIn is undefined until isLoaded flips true, so guard on isLoaded first
// or a hard refresh bounces a signed-in official straight back to /sign-in.
export default function ProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-on-surface-variant">
        Loading...
      </div>
    )
  }

  if (!isSignedIn) return <Navigate to="/sign-in" replace />

  return <Outlet />
}
