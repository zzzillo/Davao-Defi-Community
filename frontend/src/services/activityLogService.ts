/**
 * Every call this app makes to the activity logs API, and nothing else.
 *
 * The shortest service in the project: one function, because the endpoint has
 * one route. There is no create, update or delete here because there are none
 * there - entries are written by the API itself, and an audit trail nobody can
 * edit is the point of the table.
 */

import type {
  ActivityLogListParams,
  ActivityLogListResponse,
} from '../types/activityLog'
import { apiRequest, toQueryString } from './api'

const BASE_PATH = '/activity-logs'

/** Build the query string for GET /activity-logs. See services/api.toQueryString. */
export function buildActivityLogQuery(params: ActivityLogListParams = {}): string {
  return toQueryString({ ...params })
}

/**
 * List log entries, newest first.
 *
 * The token is required rather than optional, unlike every other list in this
 * app. The other four serve published rows to anonymous visitors; this one
 * describes who did what and when, and needs the activity_logs.read permission.
 */
export function listActivityLogs(
  params: ActivityLogListParams = {},
  options: { token?: string | null; signal?: AbortSignal } = {},
): Promise<ActivityLogListResponse> {
  return apiRequest<ActivityLogListResponse>(
    `${BASE_PATH}${buildActivityLogQuery(params)}`,
    options,
  )
}
