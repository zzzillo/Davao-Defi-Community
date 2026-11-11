/**
 * The fetching machinery every module's hooks are built from.
 *
 * Extracted when Posts arrived and its hooks came out ninety-five percent
 * identical to Events'. What differed was the types and three function names;
 * what was shared was all the subtle parts - the race guard, the effect key,
 * the token handling, the in-flight flags.
 *
 * Those are exactly the parts you do not want two copies of. A bug found in a
 * duplicated race guard gets fixed in one file and quietly survives in the
 * other.
 *
 * Nothing here knows about events or posts. Each module supplies its own
 * service functions and gets typed hooks back.
 */

import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '../services/api'
import {
  invalidateResource,
  managementResourceScope,
  readCachedResourceItem,
  readResourceCache,
  setResourceCache,
  subscribeResourceInvalidations,
} from '../services/resourceCache'
import type { ResourceName } from '../services/resourceCache'
import type { Page } from '../types/pagination'
import { useAppAuth } from '../auth/useAppAuth'

/** What every service function accepts as its second argument. */
export type RequestOptions = {
  token?: string | null
  signal?: AbortSignal
}

export type ReadMode = { management?: boolean; enabled?: boolean; resource?: ResourceName }

/** Anything that is not already an ApiError - a dropped connection, mostly. */
export function asApiError(caught: unknown): ApiError {
  if (caught instanceof ApiError) return caught

  return new ApiError(0, 'Could not reach the server. Check your connection.')
}

export type UseApiListResult<TItem> = {
  items: TItem[]
  total: number
  page: number
  hasNext: boolean
  loading: boolean
  /** Cached data remains visible while this background request is running. */
  refreshing: boolean
  error: ApiError | null
  /** Re-run the request - call after creating, editing, or deleting. */
  reload: () => void
}

/**
 * A page of results, kept in sync with `params`.
 *
 * Two hazards this handles so no module has to:
 *
 * - `params` is a new object every render, so it can never be a dependency
 *   directly; the effect would loop forever. Its serialised contents can.
 * - Requests can finish out of order. Type "def" quickly and the response for
 *   "d" may land after the one for "def", overwriting the right answer with a
 *   stale one. Every run aborts the previous request and refuses to write
 *   state once it has been superseded.
 *
 * `fetcher` MUST be a stable reference - a function imported from a service
 * module, not an arrow function written at the call site. It is a dependency
 * of the effect, so an inline lambda would be a new value every render and the
 * effect would never stop refetching.
 */
export function useApiList<TItem, TParams>(
  fetcher: (params: TParams, options: RequestOptions) => Promise<Page<TItem>>,
  params: TParams,
  mode: ReadMode = {},
): UseApiListResult<TItem> {
  const { appUser, getToken, isSignedIn } = useAppAuth()
  const management = Boolean(mode.management)
  const enabled = mode.enabled ?? true
  const resource = mode.resource ?? 'activity'
  const authKey = management ? managementResourceScope(appUser, isSignedIn) : 'public'
  const [result, setResult] = useState<{ key: string; data: Page<TItem> } | null>(null)
  const [failure, setFailure] = useState<{ key: string; error: ApiError } | null>(null)
  const [activeRequestKey, setActiveRequestKey] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  const paramsKey = JSON.stringify(params)
  const requestKey = JSON.stringify([resource, authKey, paramsKey])
  const cached = readResourceCache<Page<TItem>>(resource, params, authKey)
  const currentResult = result?.key === requestKey ? result.data : cached?.data
  const currentFailure = failure?.key === requestKey ? failure.error : null

  useEffect(() => subscribeResourceInvalidations((changedResource, scope) => {
    if (changedResource === resource && (scope === undefined || scope === authKey)) {
      setReloadCount((count) => count + 1)
    }
  }), [authKey, resource])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let superseded = false

    async function load() {
      setActiveRequestKey(requestKey)
      setFailure((current) => current?.key === requestKey ? null : current)

      try {
        // Public services never inherit a Clerk session. Private drafts are
        // fetched only by explicit management hooks using /admin endpoints.
        const token = management && isSignedIn ? await getToken() : null

        const data = await fetcher(JSON.parse(paramsKey) as TParams, {
          token,
          signal: controller.signal,
        })

        if (superseded) return

        setResourceCache(resource, JSON.parse(paramsKey) as TParams, data, authKey)
        setResult({ key: requestKey, data })
      } catch (caught) {
        // An abort is us cancelling, not a failure worth showing anyone.
        if (superseded || controller.signal.aborted) return

        setFailure({ key: requestKey, error: asApiError(caught) })
      } finally {
        if (!superseded) {
          setActiveRequestKey((current) => current === requestKey ? null : current)
        }
      }
    }

    void load()

    return () => {
      superseded = true
      controller.abort()
    }
  }, [fetcher, paramsKey, requestKey, reloadCount, resource, authKey, management, enabled, isSignedIn, getToken])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])
  return {
    items: enabled ? currentResult?.items ?? [] : [],
    total: enabled ? currentResult?.total ?? 0 : 0,
    page: enabled ? currentResult?.page ?? 1 : 1,
    hasNext: enabled && Boolean(currentResult?.has_next),
    loading: enabled && !currentResult && (activeRequestKey === requestKey || !currentFailure),
    refreshing: enabled && Boolean(currentResult) && activeRequestKey === requestKey,
    error: enabled ? currentFailure : null,
    reload,
  }
}

export type UseApiItemResult<T> = {
  item: T | null
  loading: boolean
  refreshing: boolean
  error: ApiError | null
  reload: () => void
}

/**
 * One record by id. Pass null or undefined while the id is still unknown.
 *
 * The no-id case is handled by deriving the returned values rather than by
 * resetting state inside the effect. Clearing state in an effect body would
 * schedule a second render purely to undo the first one.
 */
export function useApiItem<T>(
  fetcher: (id: string, options: RequestOptions) => Promise<T>,
  id: string | null | undefined,
  mode: ReadMode = {},
): UseApiItemResult<T> {
  const { appUser, getToken, isSignedIn } = useAppAuth()
  const management = Boolean(mode.management)
  const enabled = mode.enabled ?? true
  const resource = mode.resource ?? 'activity'
  const authKey = management ? managementResourceScope(appUser, isSignedIn) : 'public'
  const requestKey = JSON.stringify([resource, authKey, id ?? ''])

  const [fetched, setFetched] = useState<{ key: string; item: T } | null>(null)
  const [fetchingKey, setFetchingKey] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ key: string; error: ApiError } | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const cached = id
    ? readResourceCache<T>(resource, id, authKey) ?? readCachedResourceItem<T>(resource, id, authKey)
    : null
  const currentResult = fetched?.key === requestKey ? fetched.item : cached?.data ?? null
  const currentFailure = failure?.key === requestKey ? failure.error : null

  useEffect(() => subscribeResourceInvalidations((changedResource, scope) => {
    if (changedResource === resource && (scope === undefined || scope === authKey)) {
      setReloadCount((count) => count + 1)
    }
  }), [authKey, resource])

  useEffect(() => {
    if (!id || !enabled) return

    // Captured after the guard: TypeScript does not carry the narrowing of a
    // parameter into a nested function, so `id` reads as possibly undefined
    // inside load() without this.
    const recordId = id

    const controller = new AbortController()
    let superseded = false

    async function load() {
      setFetchingKey(requestKey)
      setFailure(null)

      try {
        const token = management && isSignedIn ? await getToken() : null
        const data = await fetcher(recordId, { token, signal: controller.signal })

        if (!superseded) {
          setResourceCache(resource, recordId, data, authKey)
          setFetched({ key: requestKey, item: data })
        }
      } catch (caught) {
        if (superseded || controller.signal.aborted) return

        setFailure({ key: requestKey, error: asApiError(caught) })
      } finally {
        if (!superseded) {
          setFetchingKey((current) => current === requestKey ? null : current)
        }
      }
    }

    void load()

    return () => {
      superseded = true
      controller.abort()
    }
  }, [fetcher, id, requestKey, reloadCount, resource, authKey, management, enabled, isSignedIn, getToken])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])
  return {
    item: id && enabled ? currentResult : null,
    loading: Boolean(id && enabled && !currentResult && (fetchingKey === requestKey || !currentFailure)),
    refreshing: Boolean(id && enabled && currentResult && fetchingKey === requestKey),
    error: id && enabled ? currentFailure : null,
    reload,
  }
}

export type UseAuthedActionResult = {
  /** Run one authenticated write, with the token and flags handled for you. */
  run: <T>(action: (token: string) => Promise<T>) => Promise<T>
  /** True while any write is in flight - drive button disabled states. */
  saving: boolean
  error: ApiError | null
  clearError: () => void
}

/**
 * The wrapper every write goes through.
 *
 * Each action both records the error and rethrows it. The stored copy drives a
 * shared banner; the throw lets the caller decide what to do next, which is
 * usually "stay on the form rather than navigating away and losing what was
 * typed".
 */
export function useAuthedAction(resources: readonly ResourceName[] = []): UseAuthedActionResult {
  const { appUser, getToken, isSignedIn } = useAppAuth()
  const managementScope = managementResourceScope(appUser, isSignedIn)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const run = useCallback(
    async <T,>(action: (token: string) => Promise<T>): Promise<T> => {
      setSaving(true)
      setError(null)

      try {
        const token = await getToken()

        if (!token) {
          // Signed out, or the session expired while the form was open.
          throw new ApiError(401, 'Please sign in to continue')
        }

        const result = await action(token)
        for (const resource of resources) {
          invalidateResource(resource, 'public')
          invalidateResource(resource, managementScope)
        }
        if (resources.length) invalidateResource('dashboard', managementScope)
        return result
      } catch (caught) {
        const apiError = asApiError(caught)
        setError(apiError)
        throw apiError
      } finally {
        setSaving(false)
      }
    },
    [getToken, managementScope, resources],
  )

  const clearError = useCallback(() => setError(null), [])

  return { run, saving, error, clearError }
}
