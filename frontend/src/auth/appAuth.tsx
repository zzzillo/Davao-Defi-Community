import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth, useClerk } from '@clerk/react'
import { ApiError } from '../services/api'
import { getCurrentUser, syncCurrentUser } from '../services/userService'
import type { AppUser } from '../types/user'
import { AppAuthContext } from './appAuthContext'
import type { AppAuthError, AppAuthValue } from './appAuthContext'

export function AuthUnavailableProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AppAuthValue>(() => ({
    appUser: null,
    loading: false,
    error: {
      reason: 'clerk_publishable_key_missing',
      message: 'Sign-in is not configured for this frontend. Add the Clerk publishable key to the local frontend environment.',
      status: 503,
      retryable: false,
    },
    isLoaded: true,
    isSignedIn: false,
    getToken: async () => null,
    refreshUser: async () => {},
    signOut: async () => {},
  }), [])
  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
}

function toAuthError(error: unknown): AppAuthError {
  if (error instanceof ApiError) {
    const retryable = error.status >= 500 || error.status === 0 || error.reason === 'profile_not_synced'
    return {
      reason: error.reason,
      message: error.message,
      status: error.status,
      retryable,
    }
  }
  return {
    reason: null,
    message: 'We could not load your account. Check your connection and try again.',
    status: 0,
    retryable: true,
  }
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth()
  const clerk = useClerk()
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppAuthError | null>(null)
  const [responseUserId, setResponseUserId] = useState<string | null>(null)
  const requestId = useRef(0)
  const previousUserId = useRef<string | null>(null)
  const activeController = useRef<AbortController | null>(null)

  const requestCurrentUser = useCallback(async (signal?: AbortSignal, syncIfMissing = true) => {
    const token = await getToken()
    if (!token) throw new ApiError(401, 'Please sign in to continue', 'session_token_missing')

    try {
      return await getCurrentUser(token, { signal })
    } catch (caught) {
      if (syncIfMissing && caught instanceof ApiError && caught.status === 409 && caught.reason === 'profile_not_synced') {
        return syncCurrentUser(token, { signal })
      }
      throw caught
    }
  }, [getToken])

  const refreshUser = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    if (!isLoaded || !isSignedIn) {
      setAppUser(null)
      setError(null)
      setResponseUserId(null)
      setLoading(false)
      return
    }
    activeController.current?.abort()
    const controller = new AbortController()
    activeController.current = controller
    const id = ++requestId.current
    if (!background) {
      setLoading(true)
      setError(null)
      setResponseUserId(null)
    }
    try {
      const nextUser = await requestCurrentUser(controller.signal, !background)
      if (requestId.current === id && !controller.signal.aborted) {
        setAppUser(nextUser)
        setError(null)
        setResponseUserId(userId ?? null)
      }
    } catch (caught) {
      if (requestId.current === id && !controller.signal.aborted) {
        const authFailure = caught instanceof ApiError && (caught.status === 401 || caught.status === 403)
        if (!background || authFailure) {
          setAppUser(null)
          setError(toAuthError(caught))
          setResponseUserId(userId ?? null)
        }
      }
    } finally {
      if (!background && requestId.current === id && !controller.signal.aborted) setLoading(false)
      if (activeController.current === controller) activeController.current = null
    }
  }, [isLoaded, isSignedIn, requestCurrentUser, userId])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || loading || responseUserId !== userId) return

    // Roles and account status live in PostgreSQL. Refresh them when someone
    // returns to this tab, without putting an ordinary focus transition into
    // the blocking auth-loading state that would unmount an open form.
    const refreshOnFocus = () => { void refreshUser({ background: true }) }
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [isLoaded, isSignedIn, loading, refreshUser, responseUserId, userId])

  useEffect(() => {
    const controller = new AbortController()
    activeController.current?.abort()
    activeController.current = controller
    const id = ++requestId.current

    if (!isLoaded) {
      return () => controller.abort()
    }

    if (!isSignedIn || !userId) {
      previousUserId.current = null
      return () => {
        controller.abort()
        if (activeController.current === controller) activeController.current = null
      }
    }

    // Clear the previous identity immediately when Clerk switches accounts so
    // a stale database role is never shown while the new session loads.
    if (previousUserId.current !== userId) {
      previousUserId.current = userId
      setAppUser(null)
      setError(null)
    }

    void requestCurrentUser(controller.signal).then((nextUser) => {
      if (!controller.signal.aborted && requestId.current === id) {
        setAppUser(nextUser)
        setError(null)
        setResponseUserId(userId)
      }
    }).catch((caught: unknown) => {
      if (!controller.signal.aborted && requestId.current === id) {
        setAppUser(null)
        setError(toAuthError(caught))
        setResponseUserId(userId)
      }
    }).finally(() => {
      if (!controller.signal.aborted && requestId.current === id) setLoading(false)
    })

    return () => {
      controller.abort()
      if (activeController.current === controller) activeController.current = null
    }
  }, [isLoaded, isSignedIn, userId, requestCurrentUser])

  const signOut = useCallback(async () => {
    ++requestId.current
    activeController.current?.abort()
    activeController.current = null
    setAppUser(null)
    setError(null)
    setResponseUserId(null)
    setLoading(false)
    previousUserId.current = null
    await clerk.signOut()
  }, [clerk])

  const getCurrentToken = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return null
    return getToken()
  }, [getToken, isLoaded, isSignedIn])

  const contextUser = isSignedIn && appUser?.clerk_user_id === userId ? appUser : null
  const contextError = isSignedIn && responseUserId === userId ? error : null
  const contextLoading = !isLoaded || Boolean(isSignedIn && (loading || (responseUserId !== userId && !contextError)))

  const contextValue = useMemo<AppAuthValue>(() => ({
    appUser: contextUser,
    loading: contextLoading,
    error: contextError,
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    getToken: getCurrentToken,
    refreshUser,
    signOut,
  }), [contextError, contextLoading, contextUser, getCurrentToken, isLoaded, isSignedIn, refreshUser, signOut])

  return <AppAuthContext.Provider value={contextValue}>{children}</AppAuthContext.Provider>
}

