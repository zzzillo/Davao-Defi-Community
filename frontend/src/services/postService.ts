/**
 * Every call this app makes to the posts API, and nothing else.
 *
 * Plain async functions, no React. That is deliberate: a component, a hook, or
 * a future script can all call these, and they can be reasoned about without a
 * render in the picture. The token is a parameter rather than something read
 * from context, so which calls are authenticated is visible at a glance.
 *
 * Written to match eventService exactly, because the hooks in
 * useApiResource.ts expect this shape from every module.
 */

import type {
  PostCreatePayload,
  PostListParams,
  PostListResponse,
  PostResponse,
  PostUpdatePayload,
} from '../types/post'
import { apiRequest } from './api'

const BASE_PATH = '/posts'

/**
 * Build the query string, skipping anything the caller left out.
 *
 * Sending `search=` is not the same as omitting it - the backend would try to
 * filter on an empty string and match nothing. Only set keys are sent.
 */
export function buildPostQuery(params: PostListParams = {}): string {
  const query = new URLSearchParams()

  if (params.search) query.set('search', params.search)
  if (params.event_id) query.set('event_id', params.event_id)
  if (params.creator_id) query.set('creator_id', params.creator_id)
  if (params.include_drafts) query.set('include_drafts', 'true')
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))

  const encoded = query.toString()

  return encoded ? `?${encoded}` : ''
}

/**
 * List posts.
 *
 * The token is optional because this endpoint is public. Pass one when the
 * caller may see drafts; without it, include_drafts gets a 401.
 */
export function listPosts(
  params: PostListParams = {},
  options: { token?: string | null; signal?: AbortSignal } = {},
): Promise<PostListResponse> {
  return apiRequest<PostListResponse>(`${BASE_PATH}${buildPostQuery(params)}`, options)
}

/** One post. Public, but a draft is 404 without a token that may see drafts. */
export function getPost(
  id: string,
  options: { token?: string | null; signal?: AbortSignal } = {},
): Promise<PostResponse> {
  return apiRequest<PostResponse>(`${BASE_PATH}/${id}`, options)
}

/**
 * Create a post. Requires the posts.create permission.
 *
 * A 409 means the event already has a recap; a 422 naming event_not_found
 * means the event_id does not exist at all.
 */
export function createPost(
  payload: PostCreatePayload,
  token: string,
): Promise<PostResponse> {
  return apiRequest<PostResponse>(BASE_PATH, { method: 'POST', body: payload, token })
}

/**
 * Update a post. Requires posts.update.
 *
 * Send only what changed. A key left off is left alone on the server; a key set
 * to null clears it. `images` follows the same rule with a third meaning:
 * omitted leaves the gallery alone, [] empties it, an array replaces it.
 */
export function updatePost(
  id: string,
  payload: PostUpdatePayload,
  token: string,
): Promise<PostResponse> {
  return apiRequest<PostResponse>(`${BASE_PATH}/${id}`, {
    method: 'PATCH',
    body: payload,
    token,
  })
}

/** Delete a post permanently. Requires posts.delete. Returns nothing. */
export function deletePost(id: string, token: string): Promise<void> {
  return apiRequest<void>(`${BASE_PATH}/${id}`, { method: 'DELETE', token })
}
