import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DemoAuthContext, STORAGE_KEY, demoUser } from './demoAuthContext'

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'signed-in' ? demoUser : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    function syncSession(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setUser(event.newValue === 'signed-in' ? demoUser : null)
    }
    window.addEventListener('storage', syncSession)
    return () => window.removeEventListener('storage', syncSession)
  }, [])

  const signIn = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'signed-in')
    setUser(demoUser)
  }, [])
  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])
  const getToken = useCallback(async () => user ? 'demo-session-token' : null, [user])
  const value = useMemo(() => ({
    isLoaded: true,
    user,
    isSignedIn: Boolean(user),
    signIn,
    signOut,
    getToken,
  }), [user, signIn, signOut, getToken])

  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>
}
