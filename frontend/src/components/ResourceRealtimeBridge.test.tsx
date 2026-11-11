import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppAuthContext } from '../auth/appAuthContext'
import type { AppAuthValue } from '../auth/appAuthContext'
import {
  clearAllResourceCache,
  readResourceCache,
  setResourceCache,
  subscribeResourceInvalidations,
} from '../services/resourceCache'

const mocked = vi.hoisted(() => ({ runResourceEventStream: vi.fn() }))

vi.mock('../services/realtime', () => ({ runResourceEventStream: mocked.runResourceEventStream }))

import ResourceRealtimeBridge from './ResourceRealtimeBridge'

function value(user: AppAuthValue['appUser'], isSignedIn = user !== null): AppAuthValue {
  return {
    appUser: user,
    loading: false,
    error: null,
    isLoaded: true,
    isSignedIn,
    getToken: async () => 'session-token',
    refreshUser: async () => {},
    signOut: async () => {},
  }
}

const userA = { id: 'db-a', clerk_user_id: 'clerk-a', role: 'admin', status: 'active' } as AppAuthValue['appUser']
const userB = { id: 'db-b', clerk_user_id: 'clerk-b', role: 'official', status: 'active' } as AppAuthValue['appUser']

afterEach(() => {
  cleanup()
  clearAllResourceCache()
  vi.clearAllMocks()
})

describe('resource realtime bridge', () => {
  it('opens one authenticated stream and aborts it when the provider unmounts', async () => {
    mocked.runResourceEventStream.mockResolvedValue(undefined)
    const auth = value(userA)
    auth.refreshUser = vi.fn(async () => {})
    const view = render(
      <AppAuthContext.Provider value={auth}>
        <ResourceRealtimeBridge />
      </AppAuthContext.Provider>,
    )

    expect(mocked.runResourceEventStream).toHaveBeenCalledTimes(1)
    const options = mocked.runResourceEventStream.mock.calls[0][0] as { signal: AbortSignal; getToken: () => Promise<string | null> }
    expect(await options.getToken()).toBe('session-token')
    expect(options.signal.aborted).toBe(false)
    const streamOptions = mocked.runResourceEventStream.mock.calls[0][0] as {
      onResource: (resource: 'users') => void
    }
    act(() => streamOptions.onResource('users'))
    expect(auth.refreshUser).toHaveBeenCalledWith({ background: true })

    await act(async () => view.unmount())

    expect(options.signal.aborted).toBe(true)
  })

  it('clears management cache on account switch and signout while preserving public cache', () => {
    setResourceCache('events', {}, ['private'], 'management:db-a:clerk-a:admin:active')
    setResourceCache('events', {}, ['public'], 'public')
    const view = render(
      <AppAuthContext.Provider value={value(userA)}>
        <ResourceRealtimeBridge />
      </AppAuthContext.Provider>,
    )

    act(() => {
      view.rerender(
        <AppAuthContext.Provider value={value(userB)}>
          <ResourceRealtimeBridge />
        </AppAuthContext.Provider>,
      )
    })

    expect(readResourceCache('events', {}, 'management:db-a:clerk-a:admin:active')).toBeNull()
    expect(readResourceCache('events', {}, 'public')?.data).toEqual(['public'])

    act(() => {
      view.rerender(
        <AppAuthContext.Provider value={value(null, false)}>
          <ResourceRealtimeBridge />
        </AppAuthContext.Provider>,
      )
    })
    expect(readResourceCache('events', {}, 'management:db-b:clerk-b:official:active')).toBeNull()
  })

  it('revalidates cached resources when the tab returns to the foreground', () => {
    mocked.runResourceEventStream.mockResolvedValue(undefined)
    const received: string[] = []
    const unsubscribe = subscribeResourceInvalidations((resource) => received.push(resource))
    render(
      <AppAuthContext.Provider value={value(null, false)}>
        <ResourceRealtimeBridge />
      </AppAuthContext.Provider>,
    )

    expect(mocked.runResourceEventStream).not.toHaveBeenCalled()
    act(() => window.dispatchEvent(new Event('focus')))

    expect(received).toEqual(expect.arrayContaining(['events', 'posts', 'blogs', 'partners', 'users', 'dashboard']))
    unsubscribe()
  })
})
