import { createContext } from 'react'

export type DemoUser = {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: 'admin'
}

export const demoUser: DemoUser = {
  id: 'demo-sarah-jenkins',
  firstName: 'Sarah',
  lastName: 'Jenkins',
  fullName: 'Sarah Jenkins',
  email: 'sarah@davaodefi.org',
  role: 'admin',
}

export const STORAGE_KEY = 'ddc-demo-session'
export type DemoAuthValue = {
  isLoaded: boolean
  user: DemoUser | null
  isSignedIn: boolean
  signIn: () => void
  signOut: () => void
  getToken: () => Promise<string | null>
}
export const DemoAuthContext = createContext<DemoAuthValue | null>(null)
