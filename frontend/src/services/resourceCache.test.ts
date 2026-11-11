import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllResourceCache,
  clearManagementResourceCache,
  invalidateResource,
  MAX_RESOURCE_CACHE_ENTRIES,
  readResourceCache,
  setResourceCache,
  subscribeResourceInvalidations,
} from './resourceCache'

describe('resource response cache', () => {
  beforeEach(() => {
    clearAllResourceCache()
    clearManagementResourceCache()
    invalidateResource('events')
    invalidateResource('posts')
    invalidateResource('dashboard')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keys values by resource, parameters, and management identity scope', () => {
    const result = { items: [{ id: 'event-a' }], total: 1 }
    setResourceCache('events', { limit: 10 }, result, 'management:user-a:admin:active')

    expect(readResourceCache('events', { limit: 10 }, 'management:user-a:admin:active')?.data)
      .toEqual(result)
    expect(readResourceCache('events', { limit: 20 }, 'management:user-a:admin:active'))
      .toBeNull()
    expect(readResourceCache('events', { limit: 10 }, 'management:user-b:admin:active'))
      .toBeNull()
    expect(readResourceCache('posts', { limit: 10 }, 'management:user-a:admin:active'))
      .toBeNull()
  })

  it('invalidates just the selected identity scope and notifies subscribers', () => {
    const received: Array<{ resource: string; scope?: string }> = []
    const unsubscribe = subscribeResourceInvalidations((resource, scope) => {
      received.push({ resource, scope })
    })
    const scopeA = 'management:user-a:admin:active'
    const scopeB = 'management:user-b:admin:active'
    setResourceCache('events', {}, ['a'], scopeA)
    setResourceCache('events', {}, ['b'], scopeB)

    invalidateResource('events', scopeA)

    expect(readResourceCache('events', {}, scopeA)?.stale).toBe(true)
    expect(readResourceCache('events', {}, scopeB)?.stale).toBe(false)
    expect(received).toEqual([{ resource: 'events', scope: scopeA }])
    unsubscribe()
  })

  it('clears all private management entries without clearing public entries', () => {
    setResourceCache('blogs', {}, ['public'], 'public')
    setResourceCache('blogs', {}, ['private'], 'management:user-a:admin:active')

    clearManagementResourceCache()

    expect(readResourceCache('blogs', {}, 'public')?.data).toEqual(['public'])
    expect(readResourceCache('blogs', {}, 'management:user-a:admin:active')).toBeNull()
  })

  it('evicts the least recently used key when the cache exceeds its size limit', () => {
    for (let index = 0; index < MAX_RESOURCE_CACHE_ENTRIES; index += 1) {
      setResourceCache('events', { page: index }, index, 'public')
    }

    // Refresh page 0's recency so page 1 becomes the oldest entry.
    expect(readResourceCache('events', { page: 0 }, 'public')?.data).toBe(0)
    setResourceCache('events', { page: MAX_RESOURCE_CACHE_ENTRIES }, 'new', 'public')

    expect(readResourceCache('events', { page: 0 }, 'public')?.data).toBe(0)
    expect(readResourceCache('events', { page: 1 }, 'public')).toBeNull()
    expect(readResourceCache('events', { page: MAX_RESOURCE_CACHE_ENTRIES }, 'public')?.data)
      .toBe('new')
  })

  it('keeps cached responses available for the lifetime of the in-memory session', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    setResourceCache('blogs', { page: 1 }, ['cached'], 'public')

    // Cache entries are memory-only and bounded by the LRU size limit. Time
    // spent on another page should not turn a returning list into a cold load.
    vi.advanceTimersByTime(24 * 60 * 60 * 1000)
    expect(readResourceCache('blogs', { page: 1 }, 'public')?.data).toEqual(['cached'])
  })
})
