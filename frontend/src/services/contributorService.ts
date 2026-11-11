import type { BlogListResponse } from '../types/blog'
import type {
  ContributorBlogListParams,
  ContributorListParams,
  ContributorListResponse,
  ContributorResponse,
} from '../types/contributor'
import { apiRequest, toQueryString } from './api'

const BASE_PATH = '/users/contributors'

/** Anonymous public directory. The response only contains directory fields. */
export function listContributors(
  params: ContributorListParams = {},
  options: { signal?: AbortSignal } = {},
): Promise<ContributorListResponse> {
  return apiRequest<ContributorListResponse>(`${BASE_PATH}${toQueryString(params)}`, options)
}

/** Resolve the public URL slug, never a database id. */
export function getContributor(
  publicSlug: string,
  options: { signal?: AbortSignal } = {},
): Promise<ContributorResponse> {
  return apiRequest<ContributorResponse>(
    `${BASE_PATH}/${encodeURIComponent(publicSlug)}`,
    options,
  )
}

/** Published articles for this public contributor slug only. */
export function listContributorBlogs(
  publicSlug: string,
  params: ContributorBlogListParams = {},
  options: { signal?: AbortSignal } = {},
): Promise<BlogListResponse> {
  return apiRequest<BlogListResponse>(
    `${BASE_PATH}/${encodeURIComponent(publicSlug)}/blogs${toQueryString(params)}`,
    options,
  )
}
