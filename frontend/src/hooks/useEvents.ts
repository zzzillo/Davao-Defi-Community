/**
 * React's view of the events API.
 *
 * The service layer knows how to call the backend; these hooks know when to
 * call it, how to keep a component's state honest while it is in flight, and
 * where the Clerk token comes from. Pages use these and stay free of fetch
 * logic, loading flags, and race conditions.
 *
 * getToken is listed as a dependency rather than stashed in a ref: Clerk builds
 * it with useCallback over a value that lives as long as the app, so its
 * identity is stable and depending on it cannot cause a refetch loop.
 */

import { useAuth } from '@clerk/react'
import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '../services/api'
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from '../services/eventService'
import type {
  EventCreatePayload,
  EventListParams,
  EventResponse,
  EventUpdatePayload,
} from '../types/event'

/** Anything that is not already an ApiError - a dropped connection, mostly. */
function asApiError(caught: unknown): ApiError {
  if (caught instanceof ApiError) return caught

  return new ApiError(0, 'Could not reach the server. Check your connection.')
}

export type UseEventsResult = {
  events: EventResponse[]
  total: number
  loading: boolean
  error: ApiError | null
  /** Re-run the request - call after creating, editing, or deleting. */
  reload: () => void
}

/**
 * A page of events, kept in sync with `params`.
 *
 * Two hazards this handles so no page has to:
 *
 * - `params` is a new object every render, so it can never be a dependency
 *   directly; the effect would loop forever. Its serialised contents can.
 * - Requests can finish out of order. Type "def" quickly and the response for
 *   "d" may land after the one for "def", overwriting the right answer with a
 *   stale one. Every run aborts the previous request and refuses to write state
 *   once it has been superseded.
 */
export function useEvents(params: EventListParams = {}): UseEventsResult {
  const { getToken, isSignedIn } = useAuth()

  const [events, setEvents] = useState<EventResponse[]>([])
  const [total, setTotal] = useState(0)
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

        const data = await listEvents(JSON.parse(paramsKey) as EventListParams, {
          token,
          signal: controller.signal,
        })

        if (superseded) return

        setEvents(data.items)
        setTotal(data.total)
      } catch (caught) {
        // An abort is us cancelling, not a failure worth showing anyone.
        if (superseded || controller.signal.aborted) return

        setError(asApiError(caught))
        setEvents([])
        setTotal(0)
      } finally {
        if (!superseded) setLoading(false)
      }
    }

    void load()

    return () => {
      superseded = true
      controller.abort()
    }
  }, [paramsKey, reloadCount, isSignedIn, getToken])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return { events, total, loading, error, reload }
}

export type UseEventResult = {
  event: EventResponse | null
  loading: boolean
  error: ApiError | null
  reload: () => void
}

/**
 * One event by id. Pass null or undefined while the id is still unknown.
 *
 * The no-id case is handled by deriving the returned values rather than by
 * resetting state inside the effect. Clearing state in an effect body would
 * schedule a second render purely to undo the first one.
 */
export function useEvent(id: string | null | undefined): UseEventResult {
  const { getToken, isSignedIn } = useAuth()

  const [fetched, setFetched] = useState<EventResponse | null>(null)
  const [fetching, setFetching] = useState(Boolean(id))
  const [error, setError] = useState<ApiError | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!id) return

    // Captured after the guard: TypeScript does not carry the narrowing of a
    // parameter into a nested function, so `id` reads as possibly undefined
    // inside load() without this.
    const eventId = id

    const controller = new AbortController()
    let superseded = false

    async function load() {
      setFetching(true)
      setError(null)

      try {
        const token = isSignedIn ? await getToken() : null
        const data = await getEvent(eventId, { token, signal: controller.signal })

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
  }, [id, reloadCount, isSignedIn, getToken])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return {
    event: id ? fetched : null,
    loading: id ? fetching : false,
    error: id ? error : null,
    reload,
  }
}

export type UseEventActionsResult = {
  create: (payload: EventCreatePayload) => Promise<EventResponse>
  update: (id: string, payload: EventUpdatePayload) => Promise<EventResponse>
  remove: (id: string) => Promise<void>
  /** True while any of the three is in flight - drive button disabled states. */
  saving: boolean
  error: ApiError | null
  clearError: () => void
}

/**
 * The three writes, with the token and the in-flight flag handled once.
 *
 * Each action both records the error and rethrows it. The stored copy drives a
 * shared banner; the throw lets the caller decide what to do next, which is
 * usually "stay on the form rather than navigating away".
 */
export function useEventActions(): UseEventActionsResult {
  const { getToken } = useAuth()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  /** Wrap one write: token, flags, error capture. */
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

  const create = useCallback(
    (payload: EventCreatePayload) => run((token) => createEvent(payload, token)),
    [run],
  )

  const update = useCallback(
    (id: string, payload: EventUpdatePayload) =>
      run((token) => updateEvent(id, payload, token)),
    [run],
  )

  const remove = useCallback(
    (id: string) => run((token) => deleteEvent(id, token)),
    [run],
  )

  const clearError = useCallback(() => setError(null), [])

  return { create, update, remove, saving, error, clearError }
}
