import { useContext } from 'react'
import { AppAuthContext } from './appAuthContext'
import type { AppAuthValue } from './appAuthContext'
import type { AppUser } from '../types/user'

export function useAppAuth(): AppAuthValue {
  const value = useContext(AppAuthContext)
  if (!value) throw new Error('useAppAuth must be used inside AppAuthProvider')
  return value
}

export function useAppUser(): AppUser | null {
  return useAppAuth().appUser
}
