/**
 * Mirrors of the backend's post schemas.
 *
 * Field names are snake_case because that is what crosses the wire. A camelCase
 * layer would mean a translation step in both directions, and every mistake in
 * it shows up as a silent `undefined` rather than a type error.
 *
 * Hand-written, so they can drift from app/schemas/post.py. Check
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
export type PostCreator = PublicUser

/**
 * Just enough of a linked event to render a link back to it.
 *
 * Not the full EventResponse: the API deliberately sends a slim version, so a
 * post and an event cannot end up embedding each other.
 */
export type PostEvent = {
  id: string
  title: string
  /** ISO 8601 with a UTC offset - an instant, unlike post_date below. */
  start_datetime: string
  published: boolean
}

export type PostImage = {
  id: string
  display_order: number
  /**
   * The storage key. Published so an edit can send back the images it keeps -
   * PATCH replaces the whole gallery, and this is the only identity the form
   * has for a photograph it did not just pick.
   */
  image_key: string
  /** Already resolved by the backend. Null when storage is unconfigured. */
  image_url: string | null
}

/** One post, exactly as GET /posts returns it. */
export type PostResponse = {
  id: string
  title: string | null
  /** Sanitised HTML from the backend. Safe to render; see EventDetails. */
  description: string | null
  location: string | null
  /**
   * A calendar day as "YYYY-MM-DD". NOT an instant, and not interchangeable
   * with the ISO datetimes elsewhere in this app.
   *
   * Never pass this through `new Date(...)`. A date-only string is parsed as
   * UTC midnight and then rendered in local time, so it reads a day early
   * anywhere west of UTC. Format it from its own parts - see formatPostDate.
   */
  post_date: string
  published: boolean
  /** ISO 8601 instants, unlike post_date. */
  created_at: string
  updated_at: string
  creator: PostCreator | null
  /** Present only when this post recaps an event. */
  event: PostEvent | null
  /** Already ordered by the server. */
  images: PostImage[]
}

export type PostListResponse = Page<PostResponse>

/** One image on the way in. Order comes from position in the array. */
export type PostImagePayload = {
  image_key: string
}

/** Body for POST /posts. No creator field: the server takes that from the token. */
export type PostCreatePayload = {
  title?: string | null
  description?: string | null
  location?: string | null
  /** "YYYY-MM-DD". */
  post_date: string
  /** Omit or null for a standalone post. An event may have only one recap. */
  event_id?: string | null
  published?: boolean
  images?: PostImagePayload[]
}

/**
 * Body for PATCH /posts/{id}.
 *
 * Omitting a key and sending null mean different things: omit to leave a field
 * alone, send null to clear it. JSON.stringify drops undefined keys, so simply
 * not setting a property does the right thing.
 *
 * `images` has a third meaning: omitted leaves the gallery untouched, [] empties
 * it, and an array replaces it wholesale.
 */
export type PostUpdatePayload = Partial<PostCreatePayload>

/** Query parameters for GET /posts. */
export type PostListParams = PageParams & {
  search?: string
  /** Only the recap of this event, if one exists. */
  event_id?: string
  creator_id?: string
  /** Unpublished posts too. The API requires the posts.read permission. */
  include_drafts?: boolean
}
