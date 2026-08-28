/**
 * Mirrors of the backend's activity log schemas.
 *
 * Hand-written, so they can drift from app/schemas/activity_log.py. Check
 * http://127.0.0.1:8000/docs after any backend schema change.
 *
 * Note what is absent: any Create or Update payload. Entries are written by
 * log_activity from inside the API, never posted by a client, and the endpoint
 * offers nothing but GET.
 */

import type { PublicUser } from './common'
import type { Page, PageParams } from './pagination'

/**
 * What kind of thing an action happened to.
 *
 * A union rather than a plain string, so a typo in a filter is a compile error
 * and every switch over it can be checked for completeness.
 */
export type ActivityResource = 'event' | 'post' | 'blog' | 'partner' | 'user'

/** What was done. Past tense, matching the backend enum exactly. */
export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'published'
  | 'unpublished'
  | 'promoted'
  | 'demoted'
  | 'updated_permissions'

/** One log entry, exactly as GET /activity-logs returns it. */
export type ActivityLogResponse = {
  id: string
  action: ActivityAction
  resource: ActivityResource

  /**
   * The affected row's id - which may point at something that no longer
   * exists, because a delete entry names what it deleted. Never follow this to
   * a page without being ready for a 404.
   */
  resource_id: string | null

  /**
   * The scraps that make a line readable: a title, a name, a role change.
   *
   * Deliberately loose. The shape varies by action, the backend validates only
   * that it is a JSON object, and pinning it to a union here would mean
   * changing this file every time a route logs one more field - while still
   * being a lie about what old rows contain. utils/activityLog reads it
   * defensively and treats every key as optional.
   */
  details: Record<string, unknown> | null

  created_at: string

  /** Null only if the actor's row was deleted. */
  user: PublicUser | null
}

export type ActivityLogListResponse = Page<ActivityLogResponse>

/** Query parameters for GET /activity-logs. */
export type ActivityLogListParams = PageParams & {
  resource?: ActivityResource
  action?: ActivityAction
  user_id?: string
}
