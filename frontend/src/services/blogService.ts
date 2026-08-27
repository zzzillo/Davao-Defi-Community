/**
 * Every call this app makes to the blogs API, and nothing else.
 *
 * Plain async functions, no React. That is deliberate: a component, a hook, or
 * a future script can all call these, and they can be reasoned about without a
 * render in the picture. The token is a parameter rather than something read
 * from context, so which calls are authenticated is visible at a glance.
 *
 * Written to match eventService and postService exactly, because the hooks in
 * useApiResource.ts expect this shape from every module.
 */

import type {
  BlogCreatePayload,
  BlogListParams,
  BlogListResponse,
  BlogResponse,
  BlogUpdatePayload,
} from '../types/blog'
import { apiRequest, toQueryString } from './api'

const BASE_PATH = '/blogs'

/**
 * Build the query string for GET /blogs.
 *
 * A spread rather than a list of `if` statements: toQueryString already knows
 * which values mean "not asked for". See services/api.ts.
 */
export function buildBlogQuery(params: BlogListParams = {}): string {
  return toQueryString({ ...params })
}

/**
 * List articles. Returns summaries - no article bodies. See types/blog.ts.
 *
 * The token is optional because this endpoint is public. Pass one when the
 * caller may see drafts; without it, include_drafts gets a 401.
 */
export function listBlogs(
  params: BlogListParams = {},
  options: { token?: string | null; signal?: AbortSignal } = {},
): Promise<BlogListResponse> {
  return apiRequest<BlogListResponse>(`${BASE_PATH}${buildBlogQuery(params)}`, options)
}

/**
 * One article by id. What the edit form loads.
 *
 * By id rather than slug because a draft's slug can still change, and an edit
 * URL that moves when the author renames the article breaks mid-edit.
 *
 * Public, but a draft is 404 without a token that may see drafts.
 */
export function getBlog(
  id: string,
  options: { token?: string | null; signal?: AbortSignal } = {},
): Promise<BlogResponse> {
  return apiRequest<BlogResponse>(`${BASE_PATH}/${id}`, options)
}

/**
 * One article by its public address. What a reader's URL resolves to.
 *
 * A separate path rather than the same route accepting either, so neither side
 * has to guess what kind of string it was handed.
 *
 * encodeURIComponent is belt-and-braces: a generated slug contains only
 * lowercase letters, digits and hyphens, none of which need escaping. It costs
 * nothing and stops a hand-typed URL from producing a malformed request.
 */
export function getBlogBySlug(
  slug: string,
  options: { token?: string | null; signal?: AbortSignal } = {},
): Promise<BlogResponse> {
  return apiRequest<BlogResponse>(
    `${BASE_PATH}/slug/${encodeURIComponent(slug)}`,
    options,
  )
}

/**
 * Create an article. Requires the blogs.create permission.
 *
 * A 409 with reason "slug_taken" means the chosen slug is in use. A 422 with
 * reason "body_required" means publishing was asked for and the article has
 * nothing in it.
 */
export function createBlog(
  payload: BlogCreatePayload,
  token: string,
): Promise<BlogResponse> {
  return apiRequest<BlogResponse>(BASE_PATH, { method: 'POST', body: payload, token })
}

/**
 * Update an article. Requires blogs.update.
 *
 * Send only what changed. A key left off is left alone on the server; a key set
 * to null clears it.
 *
 * Two 409s are possible and they mean different things: "slug_taken" is another
 * article holding that address, "slug_frozen" is this article already being
 * published. The second one is fixable by unpublishing first, so the UI should
 * offer that rather than marking the field invalid.
 */
export function updateBlog(
  id: string,
  payload: BlogUpdatePayload,
  token: string,
): Promise<BlogResponse> {
  return apiRequest<BlogResponse>(`${BASE_PATH}/${id}`, {
    method: 'PATCH',
    body: payload,
    token,
  })
}

/** Delete an article permanently. Requires blogs.delete. Returns nothing. */
export function deleteBlog(id: string, token: string): Promise<void> {
  return apiRequest<void>(`${BASE_PATH}/${id}`, { method: 'DELETE', token })
}
