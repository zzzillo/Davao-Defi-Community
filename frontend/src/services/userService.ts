import { apiRequest } from './api'
import type { AppUser, UserProfileUpdate } from '../types/user'

export type UserRequestOptions = { signal?: AbortSignal }

export function getCurrentUser(token: string, options: UserRequestOptions = {}): Promise<AppUser> {
  return apiRequest<AppUser>('/users/me', { ...options, token })
}

export function syncCurrentUser(token: string, options: UserRequestOptions = {}): Promise<AppUser> {
  return apiRequest<AppUser>('/users/sync', { ...options, method: 'POST', token })
}

export function updateMyProfile(
  payload: UserProfileUpdate,
  token: string,
  options: UserRequestOptions = {},
): Promise<AppUser> {
  return apiRequest<AppUser>('/users/me', { ...options, method: 'PATCH', body: payload, token })
}
