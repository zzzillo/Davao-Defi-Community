/**
 * Mirrors of the backend's blog schemas.
 *
 * Field names are snake_case because that is what crosses the wire. A camelCase
 * layer would mean a translation step in both directions, and every mistake in
 * it shows up as a silent `undefined` rather than a type error.
 *
 * Hand-written, so they can drift from app/schemas/blog.py. Check
 * http://127.0.0.1:8000/docs after any backend schema change.
 */

import type { PublicUser } from './common'
import type { Page, PageParams } from './pagination'

/**
 * An article without its body - what the list endpoint returns.
 *
 * THE ONE PLACE BLOGS DIFFERS FROM EVENTS AND POSTS. Those return a single
 * shape from both the list and the detail route. An article body is capped at
 * a hundred thousand characters, so twenty of them in one page would be two
 * megabytes of markup to render a grid of cards showing a title, an excerpt
 * and a picture.
 *
 * A card never needs `content`, and the type says so - reaching for it on a
 * list item is a compile error rather than a runtime `undefined`.
 */
export type BlogSummary = {
  id: string
  title: string

  /**
   * The public address: /blog/understanding-web3.
   *
   * Frozen once the article is published, because a published URL is in a
   * search index, a pinned message, and somebody's bookmarks. The API answers
   * 409 with reason "slug_frozen" if a form tries to change one.
   */
  slug: string

  /**
   * Plain text, never markup - the backend strips every tag on write.
   *
   * Safe to render as text with `{blog.excerpt}`, which is the point: this
   * string also ends up in a meta description, where HTML would be wrong.
   */
  excerpt: string | null

  published: boolean

  /**
   * When the article became public. ISO 8601 with an offset.
   *
   * Null for a draft, and distinct from created_at and updated_at on purpose:
   * an article drafted on the 3rd, published on the 10th and typo-fixed on the
   * 20th has three different dates, and this is the one that belongs under the
   * headline.
   *
   * Set once, on first publish. Unpublishing and republishing does not move it.
   */
  published_at: string | null

  created_at: string
  updated_at: string

  creator: PublicUser | null

  /**
   * The storage key. Published so the edit form can tell "no cover" apart from
   * "a cover we cannot currently build a URL for" - which is every cover until
   * R2 is configured.
   */
  cover_image_key: string | null

  /** Already resolved by the backend. Null when no cover, or R2 is unset. */
  cover_image_url: string | null
}

/** One article in full. What the detail routes return. */
export type BlogResponse = BlogSummary & {
  /**
   * Sanitised HTML from the backend. Safe to render with
   * dangerouslySetInnerHTML - see app/services/html_service.py.
   */
  content: string | null
}

export type BlogListResponse = Page<BlogSummary>

/**
 * Body for POST /blogs. No creator field: the server takes that from the token.
 *
 * `slug` is optional and normally omitted - the server derives one from the
 * title and resolves collisions itself. Send it only when the author has
 * deliberately chosen the URL, and send it already in slug form: the API
 * refuses "My Article" rather than silently rewriting it.
 */
export type BlogCreatePayload = {
  title: string
  slug?: string | null
  excerpt?: string | null
  content?: string | null
  cover_image_key?: string | null
  published?: boolean
  /** Only for backdating an imported article. Normally left to the server. */
  published_at?: string | null
}

/**
 * Body for PATCH /blogs/{id}.
 *
 * Omitting a key and sending null mean different things: omit to leave a field
 * alone, send null to clear it. JSON.stringify drops undefined keys, so simply
 * not setting a property does the right thing.
 */
export type BlogUpdatePayload = Partial<BlogCreatePayload>

/** Query parameters for GET /blogs. */
export type BlogListParams = PageParams & {
  /** Matches title and excerpt. Deliberately not the article body. */
  search?: string
  creator_id?: string
  /** Unpublished articles too. The API requires the blogs.read permission. */
  include_drafts?: boolean
}
