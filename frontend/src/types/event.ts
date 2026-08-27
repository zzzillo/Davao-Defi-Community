/**
 * Mirrors of the backend's event schemas.
 *
 * Field names are snake_case because that is what crosses the wire. A camelCase
 * layer would mean a translation step in both directions, and every mistake in
 * it shows up as a silent `undefined` rather than a type error. Keeping one
 * spelling means the network tab and this file always agree.
 *
 * Hand-written, so they can drift from app/schemas/event.py. Check
 * http://127.0.0.1:8000/docs after any backend schema change.
 */

import type { PublicUser } from './common'
import type { Page, PageParams } from './pagination'

/**
 * Blogs needed the same shape for the same reason, so it moved to
 * types/common.ts. The old name stays as an alias: it is what the types below
 * and every page already call it, and renaming it would touch files that have
 * no reason to change.
 */
export type EventCreator = PublicUser

/** One event, exactly as GET /events returns it. */
export type EventResponse = {
  id: string
  title: string
  description: string | null
  location: string | null
  /** ISO 8601 with a UTC offset. Never render raw - convert to local first. */
  start_datetime: string
  end_datetime: string | null
  published: boolean
  created_at: string
  updated_at: string
  creator: EventCreator | null
  /** Already resolved by the backend. Null when no banner, or R2 is unset. */
  banner_image_url: string | null
}

/**
 * The same page shape every module returns.
 *
 * Was {items, total}, which the backend still sends - Page simply adds limit,
 * offset, page and has_next around them. Adding fields to a response cannot
 * break a reader, which is why this could change without touching any page.
 */
export type EventListResponse = Page<EventResponse>

/** Body for POST /events. No creator field: the server takes that from the token. */
export type EventCreatePayload = {
  title: string
  description?: string | null
  location?: string | null
  /** Must carry an offset. new Date(...).toISOString() always does. */
  start_datetime: string
  end_datetime?: string | null
  banner_image_key?: string | null
  published?: boolean
}

/**
 * Body for PATCH /events/{id}.
 *
 * Omitting a key and sending null mean different things: omit to leave a field
 * alone, send null to clear it. JSON.stringify drops undefined keys, so simply
 * not setting a property does the right thing without any extra handling.
 */
export type EventUpdatePayload = Partial<EventCreatePayload>

/** Query parameters for GET /events. */
export type EventListParams = PageParams & {
  search?: string
  /** true for future events, false for past, omitted for both. */
  upcoming?: boolean
  creator_id?: string
  /** Unpublished events too. The API requires the events.read permission. */
  include_drafts?: boolean
}
