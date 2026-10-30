import { useContext } from 'react'
import { DemoAuthContext } from './demoAuthContext'

export function useDemoAuth() {
  const value = useContext(DemoAuthContext)
  if (!value) throw new Error('useDemoAuth must be used inside DemoAuthProvider')
  return value
}
