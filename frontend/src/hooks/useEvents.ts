/**
 * React's view of the events API.
 *
 * Thin on purpose. Everything hard - the out-of-order request guard, the
 * effect key, the token handling, the in-flight flags - lives once in
 * useApiResource.ts, shared with Posts and whatever comes next.
 *
 * This file used to hold all of that itself. It was extracted when Posts
 * needed the identical machinery, and the public shape of these three hooks
 * did not change: pages calling them were not touched.
 */

import { useCallback } from 'react'

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
import { useApiItem, useApiList, useAuthedAction } from './useApiResource'
import type { ApiError } from '../services/api'

export type UseEventsResult = {
  events: EventResponse[]
  total: number
  page: number
  hasNext: boolean
  loading: boolean
  error: ApiError | null
  /** Re-run the request - call after creating, editing, or deleting. */
  reload: () => void
}

/** A page of events, kept in sync with `params`. */
export function useEvents(params: EventListParams = {}): UseEventsResult {
  // listEvents is a module-level import, so its identity is stable and the
  // effect inside useApiList cannot loop on it.
  const { items, ...rest } = useApiList(listEvents, params)

  return { events: items, ...rest }
}

export type UseEventResult = {
  event: EventResponse | null
  loading: boolean
  error: ApiError | null
  reload: () => void
}

/** One event by id. Pass null or undefined while the id is still unknown. */
export function useEvent(id: string | null | undefined): UseEventResult {
  const { item, ...rest } = useApiItem(getEvent, id)

  return { event: item, ...rest }
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
  const { run, saving, error, clearError } = useAuthedAction()

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

  return { create, update, remove, saving, error, clearError }
}
