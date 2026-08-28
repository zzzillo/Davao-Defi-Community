/**
 * React's view of the activity logs API.
 *
 * One hook, because the endpoint has one route. Everything hard - the
 * out-of-order request guard, the effect key, the token handling - lives once
 * in useApiResource.ts.
 *
 * No useActivityLogActions counterpart, and there never will be one: nothing in
 * this app writes a log entry from the browser.
 */

import type { ApiError } from '../services/api'
import { listActivityLogs } from '../services/activityLogService'
import type {
  ActivityLogListParams,
  ActivityLogResponse,
} from '../types/activityLog'
import { useApiList } from './useApiResource'

export type UseActivityLogsResult = {
  entries: ActivityLogResponse[]
  total: number
  page: number
  hasNext: boolean
  loading: boolean
  error: ApiError | null
  reload: () => void
}

/** A page of log entries, newest first, kept in sync with `params`. */
export function useActivityLogs(
  params: ActivityLogListParams = {},
): UseActivityLogsResult {
  // listActivityLogs is a module-level import, so its identity is stable and
  // the effect inside useApiList cannot loop on it.
  const { items, ...rest } = useApiList(listActivityLogs, params)

  return { entries: items, ...rest }
}
