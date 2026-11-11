import type { Page, PageParams } from './pagination'

/** Public, directory-visible contributor fields returned by GET /users/contributors. */
export type ContributorResponse = {
  display_name: string
  public_slug: string
  alias: string | null
  bio: string | null
  profile_photo_key: string | null
  profile_photo_url: string | null
  positions: string[]
  contributions: string[]
  social_links: Record<string, string>
}

export type ContributorListResponse = Page<ContributorResponse>
export type ContributorListParams = PageParams & { search?: string }
export type ContributorBlogListParams = PageParams
