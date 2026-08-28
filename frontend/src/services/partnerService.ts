/**
 * Every call this app makes to the partners API, and nothing else.
 *
 * Plain async functions, no React. That is deliberate: a component, a hook, or
 * a future script can all call these, and they can be reasoned about without a
 * render in the picture.
 *
 * Written to match eventService, postService and blogService exactly, because
 * the hooks in useApiResource.ts expect this shape from every module.
 */

import type {
  PartnerCreatePayload,
  PartnerListParams,
  PartnerListResponse,
  PartnerResponse,
  PartnerUpdatePayload,
} from '../types/partner'
import { apiRequest, toQueryString } from './api'

const BASE_PATH = '/partners'

/** Build the query string for GET /partners. See services/api.toQueryString. */
export function buildPartnerQuery(params: PartnerListParams = {}): string {
  return toQueryString({ ...params })
}

/**
 * List partners, ordered alphabetically.
 *
 * No token parameter at all, unlike the other three modules. Those accept one
 * so a caller holding the read permission can ask for drafts; partners have no
 * drafts, so this endpoint is the same for everybody and there is nothing a
 * token could unlock.
 */
export function listPartners(
  params: PartnerListParams = {},
  options: { signal?: AbortSignal } = {},
): Promise<PartnerListResponse> {
  return apiRequest<PartnerListResponse>(
    `${BASE_PATH}${buildPartnerQuery(params)}`,
    options,
  )
}

/** One partner. What the officials' edit form loads. Public, like the list. */
export function getPartner(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<PartnerResponse> {
  return apiRequest<PartnerResponse>(`${BASE_PATH}/${id}`, options)
}

/**
 * Create a partner. Requires the partners.create permission.
 *
 * A 409 with reason "partner_name_taken" means that name is already listed,
 * ignoring case - "nexus technologies" collides with "Nexus Technologies".
 */
export function createPartner(
  payload: PartnerCreatePayload,
  token: string,
): Promise<PartnerResponse> {
  return apiRequest<PartnerResponse>(BASE_PATH, {
    method: 'POST',
    body: payload,
    token,
  })
}

/**
 * Update a partner. Requires partners.update.
 *
 * Send only what changed. A key left off is left alone on the server; a key set
 * to null clears it, which is how a logo gets removed.
 */
export function updatePartner(
  id: string,
  payload: PartnerUpdatePayload,
  token: string,
): Promise<PartnerResponse> {
  return apiRequest<PartnerResponse>(`${BASE_PATH}/${id}`, {
    method: 'PATCH',
    body: payload,
    token,
  })
}

/** Delete a partner permanently. Requires partners.delete. Returns nothing. */
export function deletePartner(id: string, token: string): Promise<void> {
  return apiRequest<void>(`${BASE_PATH}/${id}`, { method: 'DELETE', token })
}
