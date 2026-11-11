import type { AppRole } from '../types/user'

export type Role = AppRole

const ROLE_RANK: Record<Role, number> = {
  member: 0,
  official: 1,
  admin: 2,
  superadmin: 3,
}

/** Parse only the role loaded from the application's authenticated DB response. */
export function parseRole(raw: unknown): Role | null {
  if (raw === 'member' || raw === 'official' || raw === 'admin' || raw === 'superadmin') return raw
  return null
}

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}

/** All active database users can open the app; modules are gated separately. */
export function canOpenAdmin(_role: Role): boolean {
  return true
}

export type AdminModule = 'dashboard' | 'profile' | 'blogs' | 'events' | 'posts' | 'partners' | 'users' | 'activity'

/** Mirrors the backend's fixed cumulative module map. */
export function canAccessModule(role: Role, module: AdminModule): boolean {
  if (module === 'dashboard' || module === 'profile' || module === 'blogs') return true
  if (module === 'events' || module === 'posts' || module === 'partners') return roleAtLeast(role, 'official')
  return roleAtLeast(role, 'admin')
}
