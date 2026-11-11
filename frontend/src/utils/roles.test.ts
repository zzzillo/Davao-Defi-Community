import { describe, expect, it } from 'vitest'
import { canAccessModule, canOpenAdmin } from './roles'

describe('database role module map', () => {
  it('allows every active role into the admin shell and limits members to their own modules', () => {
    expect(canOpenAdmin('member')).toBe(true)
    expect(canAccessModule('member', 'dashboard')).toBe(true)
    expect(canAccessModule('member', 'profile')).toBe(true)
    expect(canAccessModule('member', 'blogs')).toBe(true)
    expect(canAccessModule('member', 'events')).toBe(false)
    expect(canAccessModule('member', 'posts')).toBe(false)
    expect(canAccessModule('member', 'partners')).toBe(false)
    expect(canAccessModule('member', 'users')).toBe(false)
    expect(canAccessModule('member', 'activity')).toBe(false)
  })

  it('gives officials shared content modules but keeps user management admin-only', () => {
    expect(canAccessModule('official', 'events')).toBe(true)
    expect(canAccessModule('official', 'posts')).toBe(true)
    expect(canAccessModule('official', 'partners')).toBe(true)
    expect(canAccessModule('official', 'users')).toBe(false)
    expect(canAccessModule('official', 'activity')).toBe(false)
  })

  it('includes superadmin as the highest database role', () => {
    expect(canAccessModule('superadmin', 'users')).toBe(true)
    expect(canAccessModule('superadmin', 'activity')).toBe(true)
  })
})
