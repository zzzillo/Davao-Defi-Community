import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppAuthContext } from '../auth/appAuthContext'
import type { AppAuthValue } from '../auth/appAuthContext'
import {
  clearAllResourceCache,
  invalidateResource,
  readResourceCache,
  setResourceCache,
  subscribeResourceInvalidations,
} from '../services/resourceCache'
import * as eventService from '../services/eventService'
import type { Page } from '../types/pagination'
import { useApiList } from './useApiResource'
import type { RequestOptions } from './useApiResource'
import { useEventActions } from './useEvents'

vi.mock('../services/eventService', () => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  getEvent: vi.fn(),
  getManagedEvent: vi.fn(),
  listEvents: vi.fn(),
  listManagedEvents: vi.fn(),
  updateEvent: vi.fn(),
}))

type Item = { id: string }

function authValue(user: AppAuthValue['appUser']): AppAuthValue {
  return {
    appUser: user,
    loading: false,
    error: null,
    isLoaded: true,
    isSignedIn: user !== null,
    getToken: async () => 'session-token',
    refreshUser: async () => {},
    signOut: async () => {},
  }
}

function wrapperFor(user: AppAuthValue['appUser']) {
  const value = authValue(user)
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
  }
}

function page(id: string): Page<Item> {
  return { items: [{ id }], total: 1, limit: 10, offset: 0, page: 1, has_next: false }
}

afterEach(() => {
  clearAllResourceCache()
  vi.clearAllMocks()
})

beforeEach(() => clearAllResourceCache())

describe('useApiList response cache', () => {
  it('shows cached results immediately while revalidating in the background', async () => {
    let resolveRequest!: (value: Page<Item>) => void
    const fetcher = vi.fn(() => new Promise<Page<Item>>((resolve) => { resolveRequest = resolve }))
    setResourceCache('events', { limit: 10 }, page('cached'), 'public')

    const { result } = renderHook(
      () => useApiList(fetcher, { limit: 10 }, { resource: 'events' }),
      { wrapper: wrapperFor(null) },
    )

    expect(result.current.items.map((item) => item.id)).toEqual(['cached'])
    expect(result.current.loading).toBe(false)
    expect(result.current.refreshing).toBe(true)
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

    await act(async () => resolveRequest(page('revalidated')))

    expect(result.current.items.map((item) => item.id)).toEqual(['revalidated'])
    expect(result.current.refreshing).toBe(false)
  })

  it('does not read a management result cached for a different account or role', async () => {
    const secondUser = { id: 'db-b', clerk_user_id: 'clerk-b', role: 'official', status: 'active' } as AppAuthValue['appUser']
    setResourceCache('events', {}, page('private-a'), 'management:db-a:clerk-a:admin:active')
    const fetcher = vi.fn(async (_params: Record<string, never>, _options: RequestOptions) => page('private-b'))

    const { result } = renderHook(
      () => useApiList(fetcher, {}, { management: true, resource: 'events' }),
      { wrapper: wrapperFor(secondUser) },
    )

    expect(result.current.items).toEqual([])
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['private-b']))
    expect(fetcher).toHaveBeenCalledWith({}, expect.objectContaining({ token: 'session-token' }))
  })

  it('revalidates only the management scope that received a local invalidation', async () => {
    const userA = { id: 'db-a', clerk_user_id: 'clerk-a', role: 'admin', status: 'active' } as AppAuthValue['appUser']
    const userB = { id: 'db-b', clerk_user_id: 'clerk-b', role: 'admin', status: 'active' } as AppAuthValue['appUser']
    const fetchA = vi.fn().mockResolvedValue(page('a'))
    const fetchB = vi.fn().mockResolvedValue(page('b'))
    const hookA = renderHook(
      () => useApiList(fetchA, {}, { management: true, resource: 'events' }),
      { wrapper: wrapperFor(userA) },
    )
    const hookB = renderHook(
      () => useApiList(fetchB, {}, { management: true, resource: 'events' }),
      { wrapper: wrapperFor(userB) },
    )
    await waitFor(() => expect(fetchA).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(fetchB).toHaveBeenCalledTimes(1))

    act(() => invalidateResource('events', 'management:db-a:clerk-a:admin:active'))
    await waitFor(() => expect(fetchA).toHaveBeenCalledTimes(2))

    expect(fetchB).toHaveBeenCalledTimes(1)
    hookA.unmount()
    hookB.unmount()
  })

  it('invalidates event, recap, and dashboard caches after a successful event mutation', async () => {
    const user = { id: 'db-a', clerk_user_id: 'clerk-a', role: 'admin', status: 'active' } as AppAuthValue['appUser']
    const scope = 'management:db-a:clerk-a:admin:active'
    vi.mocked(eventService.createEvent).mockResolvedValue({ id: 'created-event' } as never)
    setResourceCache('events', {}, page('event'), 'public')
    setResourceCache('events', {}, page('managed-event'), scope)
    setResourceCache('posts', {}, page('recap'), 'public')
    setResourceCache('posts', {}, page('managed-recap'), scope)
    setResourceCache('dashboard', 'current', { totals: { events: 1 } }, scope)
    const received: Array<{ resource: string; scope?: string }> = []
    const unsubscribe = subscribeResourceInvalidations((resource, targetScope) => received.push({ resource, scope: targetScope }))

    const { result } = renderHook(() => useEventActions(), { wrapper: wrapperFor(user) })

    await act(async () => {
      await result.current.create({ title: 'Community workshop' } as never)
    })

    expect(eventService.createEvent).toHaveBeenCalledWith(
      { title: 'Community workshop' },
      'session-token',
    )
    expect(readResourceCache('events', {}, 'public')?.stale).toBe(true)
    expect(readResourceCache('events', {}, scope)?.stale).toBe(true)
    expect(readResourceCache('posts', {}, 'public')?.stale).toBe(true)
    expect(readResourceCache('posts', {}, scope)?.stale).toBe(true)
    expect(readResourceCache('dashboard', 'current', scope)?.stale).toBe(true)
    expect(received).toContainEqual({ resource: 'events', scope })
    unsubscribe()
  })
})
