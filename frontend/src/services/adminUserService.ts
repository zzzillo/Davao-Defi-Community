import type {
  AdminInvitation,
  AdminInvitationListResponse,
  AdminUserProfileAndDirectoryUpdate,
  AdminUserListResponse,
  InvitationCreate,
  InvitationStatus,
  UserDirectoryUpdate,
  UserProfileUpdate,
} from '../types/adminUser'
import type { AppRole, AppUser, AppUserStatus } from '../types/user'
import { apiRequest, toQueryString } from './api'

type AuthOptions = { token: string; signal?: AbortSignal }

export type AdminUserListParams = {
  search?: string
  limit?: number
  offset?: number
}

export function listAdminUsers(
  params: AdminUserListParams = {},
  options: AuthOptions,
): Promise<AdminUserListResponse> {
  return apiRequest<AdminUserListResponse>(
    `/admin/users${toQueryString(params)}`,
    options,
  )
}

export function getAdminUser(userId: string, options: AuthOptions): Promise<AppUser> {
  return apiRequest<AppUser>(`/admin/users/${encodeURIComponent(userId)}`, options)
}

export function updateAdminUserRole(
  userId: string,
  role: AppRole,
  options: AuthOptions,
): Promise<AppUser> {
  return apiRequest<AppUser>(`/admin/users/${encodeURIComponent(userId)}/role`, {
    ...options,
    method: 'PATCH',
    body: { role },
  })
}

export function updateAdminUserStatus(
  userId: string,
  status: AppUserStatus,
  options: AuthOptions,
): Promise<AppUser> {
  return apiRequest<AppUser>(`/admin/users/${encodeURIComponent(userId)}/status`, {
    ...options,
    method: 'PATCH',
    body: { status },
  })
}

export function updateAdminUserProfile(
  userId: string,
  payload: UserProfileUpdate,
  options: AuthOptions,
): Promise<AppUser> {
  return apiRequest<AppUser>(`/admin/users/${encodeURIComponent(userId)}/profile`, {
    ...options,
    method: 'PATCH',
    body: payload,
  })
}

export function updateAdminUserProfileAndDirectory(
  userId: string,
  payload: AdminUserProfileAndDirectoryUpdate,
  options: AuthOptions,
): Promise<AppUser> {
  return apiRequest<AppUser>(`/admin/users/${encodeURIComponent(userId)}/profile-and-directory`, {
    ...options,
    method: 'PATCH',
    body: payload,
  })
}

export function updateAdminUserDirectory(
  userId: string,
  payload: UserDirectoryUpdate,
  options: AuthOptions,
): Promise<AppUser> {
  return apiRequest<AppUser>(`/admin/users/${encodeURIComponent(userId)}/directory`, {
    ...options,
    method: 'PATCH',
    body: payload,
  })
}

export type AdminInvitationListParams = {
  status?: InvitationStatus
  limit?: number
  offset?: number
}

export function listAdminInvitations(
  params: AdminInvitationListParams = {},
  options: AuthOptions,
): Promise<AdminInvitationListResponse> {
  return apiRequest<AdminInvitationListResponse>(
    `/admin/invitations${toQueryString(params)}`,
    options,
  )
}

export function createAdminInvitation(
  payload: InvitationCreate,
  idempotencyKey: string,
  options: AuthOptions,
): Promise<AdminInvitation> {
  return apiRequest<AdminInvitation>('/admin/invitations', {
    ...options,
    method: 'POST',
    body: payload,
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export function retryAdminInvitation(
  invitationId: string,
  options: AuthOptions,
): Promise<AdminInvitation> {
  return apiRequest<AdminInvitation>(
    `/admin/invitations/${encodeURIComponent(invitationId)}/retry`,
    { ...options, method: 'POST' },
  )
}

export function revokeAdminInvitation(
  invitationId: string,
  options: AuthOptions,
): Promise<AdminInvitation> {
  return apiRequest<AdminInvitation>(
    `/admin/invitations/${encodeURIComponent(invitationId)}/revoke`,
    { ...options, method: 'POST' },
  )
}
