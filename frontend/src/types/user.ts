/** Authenticated application user returned by the backend's UserResponse. */
export type AppRole = 'member' | 'official' | 'admin' | 'superadmin'
export type AppUserStatus = 'active' | 'suspended'

export type AppUser = {
  id: string
  clerk_user_id: string
  first_name: string | null
  last_name: string | null
  display_name: string
  bio: string | null
  email: string | null
  role: AppRole
  status: AppUserStatus
  alias: string | null
  public_slug: string | null
  profile_photo_key: string | null
  profile_photo_url: string | null
  positions: string[]
  contributions: string[]
  social_links: Record<string, string>
  show_in_contributor_directory: boolean
  contributor_directory_order: number | null
  team_id: string | null
}

/** Inputs shared by self-service profile editing. */
export type UserProfileUpdate = {
  display_name?: string
  bio?: string | null
  alias?: string | null
  public_slug?: string | null
  contributions?: string[]
  social_links?: Record<string, string>
  profile_photo_key?: string | null
}
