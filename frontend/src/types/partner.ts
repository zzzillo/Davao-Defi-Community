/**
 * Mirrors of the backend's partner schemas.
 *
 * Field names are snake_case because that is what crosses the wire. A camelCase
 * layer would mean a translation step in both directions, and every mistake in
 * it shows up as a silent `undefined` rather than a type error.
 *
 * Hand-written, so they can drift from app/schemas/partner.py. Check
 * http://127.0.0.1:8000/docs after any backend schema change.
 *
 * The shortest types file in this project, and worth noticing what is missing:
 * no creator, no published flag, no slug, and only one response shape rather
 * than the summary/detail pair blogs needed. A partner is small enough that a
 * list can carry the whole record.
 */

import type { Page, PageParams } from './pagination'

/** One partner, exactly as GET /partners returns it. */
export type PartnerResponse = {
  id: string

  /**
   * Unique, ignoring case. The API answers 409 with reason
   * "partner_name_taken" rather than 422 when this collides, because the name
   * is well formed - it is the world that disagrees.
   */
  name: string

  /**
   * The storage key. Published so the edit form can tell "this partner has no
   * logo" apart from "this partner has a logo we cannot currently build a URL
   * for" - which is every logo until R2 is configured.
   */
  logo_key: string | null

  /** Already resolved by the backend. Null when no logo, or R2 is unset. */
  logo_url: string | null

  created_at: string
  updated_at: string
}

export type PartnerListResponse = Page<PartnerResponse>

/** Body for POST /partners. */
export type PartnerCreatePayload = {
  name: string
  logo_key?: string | null
}

/**
 * Body for PATCH /partners/{id}.
 *
 * Omitting a key and sending null mean different things: omit to leave a field
 * alone, send null to clear it. JSON.stringify drops undefined keys, so simply
 * not setting a property does the right thing.
 */
export type PartnerUpdatePayload = Partial<PartnerCreatePayload>

/** Query parameters for GET /partners. */
export type PartnerListParams = PageParams & {
  /** Matches the name. There is nothing else on a partner to search. */
  search?: string
}
