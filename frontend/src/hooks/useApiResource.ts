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

import { useAuth } from '@clerk/react'
import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '../services/api'
import type { Page } from '../types/pagination'

/** What every service function accepts as its second argument. */
export type RequestOptions = {
  token?: string | null
  signal?: AbortSignal
}

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
): UseApiListResult<TItem> {
  const { getToken, isSignedIn } = useAuth()

  const [items, setItems] = useState<TItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    const controller = new AbortController()
    let superseded = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const token = isSignedIn ? await getToken() : null

        const data = await fetcher(JSON.parse(paramsKey) as TParams, {
          token,
          signal: controller.signal,
        })

        if (superseded) return

        setItems(data.items)
        setTotal(data.total)
        setPage(data.page)
        setHasNext(data.has_next)
      } catch (caught) {
        // An abort is us cancelling, not a failure worth showing anyone.
        if (superseded || controller.signal.aborted) return

        setError(asApiError(caught))
        setItems([])
        setTotal(0)
        setHasNext(false)
      } finally {
        if (!superseded) setLoading(false)
      }
    }

    void load()

    return () => {
      superseded = true
      controller.abort()
    }
  }, [fetcher, paramsKey, reloadCount, isSignedIn, getToken])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { items, total, page, hasNext, loading, error, reload }
}

export type UseApiItemResult<T> = {
  item: T | null
  loading: boolean
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
): UseApiItemResult<T> {
  const { getToken, isSignedIn } = useAuth()

  const [fetched, setFetched] = useState<T | null>(null)
  const [fetching, setFetching] = useState(Boolean(id))
  const [error, setError] = useState<ApiError | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!id) return

    // Captured after the guard: TypeScript does not carry the narrowing of a
    // parameter into a nested function, so `id` reads as possibly undefined
    // inside load() without this.
    const recordId = id

    const controller = new AbortController()
    let superseded = false

    async function load() {
      setFetching(true)
      setError(null)

      try {
        const token = isSignedIn ? await getToken() : null
        const data = await fetcher(recordId, { token, signal: controller.signal })

        if (!superseded) setFetched(data)
      } catch (caught) {
        if (superseded || controller.signal.aborted) return

        setError(asApiError(caught))
        setFetched(null)
      } finally {
        if (!superseded) setFetching(false)
      }
    }

    void load()

    return () => {
      superseded = true
      controller.abort()
    }
  }, [fetcher, id, reloadCount, isSignedIn, getToken])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return {
    item: id ? fetched : null,
    loading: id ? fetching : false,
    error: id ? error : null,
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
export function useAuthedAction(): UseAuthedActionResult {
  const { getToken } = useAuth()

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

        return await action(token)
      } catch (caught) {
        const apiError = asApiError(caught)
        setError(apiError)
        throw apiError
      } finally {
        setSaving(false)
      }
    },
    [getToken],
  )

  const clearError = useCallback(() => setError(null), [])

  return { run, saving, error, clearError }
}
