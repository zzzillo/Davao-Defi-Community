import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppUser } from '../types/user'

const mocks = vi.hoisted(() => ({
  clerk: {
    isLoaded: true,
    isSignedIn: true,
    userId: 'clerk-a' as string | null,
    getToken: vi.fn<() => Promise<string | null>>(),
    signOut: vi.fn<() => Promise<void>>(),
  },
  getCurrentUser: vi.fn(),
  syncCurrentUser: vi.fn(),
}))

vi.mock('@clerk/react', () => ({
  useAuth: () => ({
    isLoaded: mocks.clerk.isLoaded,
    isSignedIn: mocks.clerk.isSignedIn,
    userId: mocks.clerk.userId,
    getToken: mocks.clerk.getToken,
  }),
  useClerk: () => ({ signOut: mocks.clerk.signOut }),
}))

vi.mock('../services/userService', () => ({
  getCurrentUser: mocks.getCurrentUser,
  syncCurrentUser: mocks.syncCurrentUser,
}))

import { AppAuthProvider } from './appAuth'
import { useAppAuth as readAppAuth } from './useAppAuth'
import { ApiError } from '../services/api'

function mockUser(clerkId: string, role: AppUser['role']): AppUser {
  return {
    id: `db-${clerkId}`,
    clerk_user_id: clerkId,
    first_name: null,
    last_name: null,
    display_name: `User ${clerkId}`,
    bio: null,
    email: null,
    role,
    status: 'active',
    alias: null,
    public_slug: null,
    profile_photo_key: null,
    profile_photo_url: null,
    positions: [],
    contributions: [],
    social_links: {},
    show_in_contributor_directory: false,
    contributor_directory_order: null,
    team_id: null,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function Probe() {
  const { appUser, error, loading, signOut } = readAppAuth()
  return (
    <div>
      <span data-testid="user">{appUser?.clerk_user_id ?? 'none'}</span>
      <span data-testid="role">{appUser?.role ?? 'none'}</span>
      <span data-testid="status">{appUser?.status ?? 'none'}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error?.reason ?? ''}</span>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </div>
  )
}

function tree() {
  return <AppAuthProvider><Probe /></AppAuthProvider>
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  mocks.clerk.isLoaded = true
  mocks.clerk.isSignedIn = true
  mocks.clerk.userId = 'clerk-a'
  mocks.clerk.getToken.mockImplementation(async () => `token:${mocks.clerk.userId}`)
  mocks.clerk.signOut.mockResolvedValue(undefined)
})

describe('application auth state', () => {
  it('drops the previous database role immediately on account switch and ignores an older response', async () => {
    const requestA = deferred<AppUser>()
    const requestB = deferred<AppUser>()
    mocks.getCurrentUser.mockImplementation((token: string) => token === 'token:clerk-a' ? requestA.promise : requestB.promise)

    const view = render(tree())
    await waitFor(() => expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('loading').textContent).toBe('true')

    act(() => {
      mocks.clerk.userId = 'clerk-b'
      view.rerender(tree())
    })
    await waitFor(() => expect(mocks.getCurrentUser).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(screen.getByTestId('role').textContent).toBe('none')
    expect(screen.getByTestId('loading').textContent).toBe('true')

    await act(async () => requestB.resolve(mockUser('clerk-b', 'member')))
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('clerk-b'))
    expect(screen.getByTestId('role').textContent).toBe('member')

    await act(async () => requestA.resolve(mockUser('clerk-a', 'superadmin')))
    expect(screen.getByTestId('user').textContent).toBe('clerk-b')
    expect(screen.getByTestId('role').textContent).toBe('member')
  })

  it('does not let an in-flight profile request repopulate state during logout', async () => {
    const profileRequest = deferred<AppUser>()
    const logoutRequest = deferred<void>()
    mocks.getCurrentUser.mockReturnValue(profileRequest.promise)
    mocks.clerk.signOut.mockReturnValue(logoutRequest.promise)

    const view = render(tree())
    await waitFor(() => expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await act(async () => profileRequest.resolve(mockUser('clerk-a', 'superadmin')))
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(screen.getByTestId('role').textContent).toBe('none')

    act(() => {
      mocks.clerk.isSignedIn = false
      mocks.clerk.userId = null
      view.rerender(tree())
    })
    await act(async () => logoutRequest.resolve(undefined))
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('uses POST /users/sync only after the backend says the current profile is not synced', async () => {
    mocks.getCurrentUser.mockRejectedValue(new ApiError(409, 'Profile not synced', 'profile_not_synced'))
    mocks.syncCurrentUser.mockResolvedValue(mockUser('clerk-a', 'official'))

    render(tree())

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('clerk-a'))
    expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1)
    expect(mocks.syncCurrentUser).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('role').textContent).toBe('official')
  })

  it('refreshes role and status on window focus without blocking the current page', async () => {
    const refreshedUser = deferred<AppUser>()
    mocks.getCurrentUser
      .mockResolvedValueOnce(mockUser('clerk-a', 'superadmin'))
      .mockReturnValueOnce(refreshedUser.promise)

    render(tree())
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('superadmin'))

    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(mocks.getCurrentUser).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('role').textContent).toBe('superadmin')

    await act(async () => refreshedUser.resolve({
      ...mockUser('clerk-a', 'member'),
      status: 'suspended',
    }))
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('member'))
    expect(screen.getByTestId('status').textContent).toBe('suspended')
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })
})
