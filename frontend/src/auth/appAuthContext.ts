import { createContext } from 'react'
import type { AppUser } from '../types/user'

export type AppAuthError = {
  reason: string | null
  message: string
  status: number
  retryable: boolean
}

export type AppAuthValue = {
  appUser: AppUser | null
  loading: boolean
  error: AppAuthError | null
  isLoaded: boolean
  isSignedIn: boolean
  getToken: () => Promise<string | null>
  refreshUser: (options?: { background?: boolean }) => Promise<void>
  signOut: () => Promise<void>
}

export const AppAuthContext = createContext<AppAuthValue | null>(null)
