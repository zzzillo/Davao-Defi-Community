import type { AppRole, AppUser, AppUserStatus } from './user'

export type AdminUserListResponse = {
  items: AppUser[]
  total: number
  directory_order_count?: number
}

export type UserProfileUpdate = {
  display_name?: string
  bio?: string | null
  alias?: string | null
  public_slug?: string | null
  contributions?: string[]
  social_links?: Record<string, string>
  profile_photo_key?: string | null
}

export type UserDirectoryUpdate = {
  positions: string[]
  show_in_contributor_directory: boolean
  contributor_directory_order: number | null
}

export type AdminUserProfileAndDirectoryUpdate = UserProfileUpdate & UserDirectoryUpdate

export type InvitationStatus = 'pending' | 'failed' | 'accepted' | 'revoked' | 'expired'

export type AdminInvitation = {
  id: string
  email: string
  assigned_role: AppRole
  status: InvitationStatus
  created_at: string
  expires_at: string | null
  accepted_at: string | null
  failed_at: string | null
  delivery_attempts: number
}

export type AdminInvitationListResponse = {
  items: AdminInvitation[]
  total: number
}

export type InvitationProfileDetails = {
  display_name?: string
  bio?: string
  alias?: string
  positions?: string[]
  contributions?: string[]
  social_links?: Record<string, string>
}

export type InvitationCreate = {
  email: string
  role: AppRole
  profile_details?: InvitationProfileDetails
}

export type AdminUserRolePayload = { role: AppRole }
export type AdminUserStatusPayload = { status: AppUserStatus }
