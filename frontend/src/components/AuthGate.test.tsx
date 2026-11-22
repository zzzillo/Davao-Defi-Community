import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { useAppAuth } from '../auth/useAppAuth'
import AuthGate from './AuthGate'

const clerkLoaded = vi.fn()

vi.mock('./ClerkWithRouter', () => {
  clerkLoaded()
  return {
    default: ({ children }: { children: ReactNode }) => <div data-testid="clerk">{children}</div>,
  }
})

vi.mock('./ResourceRealtimeBridge', () => ({ default: () => null }))

function AuthState() {
  const { isSignedIn } = useAppAuth()
  return <p>{isSignedIn ? 'signed in' : 'signed out'}</p>
}

describe('AuthGate', () => {
  it('serves public pages with a signed-out context and never loads Clerk', () => {
    render(
      <MemoryRouter initialEntries={['/blogs']}>
        <AuthGate><AuthState /></AuthGate>
      </MemoryRouter>,
    )

    expect(screen.getByText('signed out')).toBeTruthy()
    expect(screen.queryByTestId('clerk')).toBeNull()
    expect(clerkLoaded).not.toHaveBeenCalled()
  })

  it('mounts Clerk for an auth route and keeps it mounted on public pages afterwards', async () => {
    render(
      <MemoryRouter initialEntries={['/sign-in']}>
        <AuthGate><Link to="/blogs">Blog</Link></AuthGate>
      </MemoryRouter>,
    )
    expect(await screen.findByTestId('clerk')).toBeTruthy()

    fireEvent.click(screen.getByRole('link', { name: 'Blog' }))
    expect(screen.getByTestId('clerk')).toBeTruthy()
  })
})
