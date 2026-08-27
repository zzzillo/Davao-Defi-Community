/**
 * Every call this app makes to the events API, and nothing else.
 *
 * Plain async functions, no React. That is deliberate: a component, a hook, or
 * a future script can all call these, and they can be reasoned about without a
 * render in the picture. The token is a parameter rather than something read
 * from context, so which calls are authenticated is visible at a glance.
 *
 * This file is the template for blogService and partnerService.
 */

import type {
  EventCreatePayload,
  EventListParams,
  EventListResponse,
  EventResponse,
  EventUpdatePayload,
} from '../types/event'
import { apiRequest, toQueryString } from './api'

const BASE_PATH = '/events'

/**
 * Build the query string for GET /events.
 *
 * A spread rather than a list of `if` statements: toQueryString already knows
 * which values mean "not asked for". See services/api.ts - and note that
 * `upcoming: false` is a real filter meaning "past events", which is exactly
 * why that rule cannot be "drop anything falsy".
 */
export function buildEventQuery(params: EventListParams = {}): string {
  return toQueryString({ ...params })
}

/**
 * List events.
 *
 * The token is optional because this endpoint is public. Pass one when the
 * caller may see drafts; without it, include_drafts gets a 401.
 */
export function listEvents(
  params: EventListParams = {},
  options: { token?: string | null; signal?: AbortSignal } = {},
): Promise<EventListResponse> {
  return apiRequest<EventListResponse>(`${BASE_PATH}${buildEventQuery(params)}`, options)
}

/** One event. Public, but a draft is 404 without a token that may see drafts. */
export function getEvent(
  id: string,
  options: { token?: string | null; signal?: AbortSignal } = {},
): Promise<EventResponse> {
  return apiRequest<EventResponse>(`${BASE_PATH}/${id}`, options)
}

/** Create an event. Requires the events.create permission. */
export function createEvent(
  payload: EventCreatePayload,
  token: string,
): Promise<EventResponse> {
  return apiRequest<EventResponse>(BASE_PATH, { method: 'POST', body: payload, token })
}

/**
 * Update an event. Requires events.update.
 *
 * Send only the fields that changed. A key left off the payload is left alone
 * on the server; a key set to null clears it.
 */
export function updateEvent(
  id: string,
  payload: EventUpdatePayload,
  token: string,
): Promise<EventResponse> {
  return apiRequest<EventResponse>(`${BASE_PATH}/${id}`, {
    method: 'PATCH',
    body: payload,
    token,
  })
}

/** Delete an event permanently. Requires events.delete. Returns nothing. */
export function deleteEvent(id: string, token: string): Promise<void> {
  return apiRequest<void>(`${BASE_PATH}/${id}`, { method: 'DELETE', token })
}
