import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useAppAuth } from '../../auth/useAppAuth'
import { getAdminDashboard } from '../../services/dashboardService'
import { clearAllResourceCache, setResourceCache } from '../../services/resourceCache'
import type { AdminDashboard } from '../../types/dashboard'
import type { AppUser } from '../../types/user'
import Dashboard from './Dashboard'

vi.mock('../../auth/useAppAuth', () => ({ useAppAuth: vi.fn() }))
vi.mock('../../services/dashboardService', () => ({ getAdminDashboard: vi.fn() }))

const user: AppUser = {
  id: 'member-1',
  clerk_user_id: 'clerk-member-1',
  first_name: 'Casey',
  last_name: 'Member',
  display_name: 'Casey Member',
  bio: null,
  email: 'casey@example.com',
  role: 'member',
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

const getToken = vi.fn(async () => 'session-token')

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAllResourceCache()
    getToken.mockResolvedValue('session-token')
    vi.mocked(useAppAuth).mockReturnValue({
      appUser: user,
      loading: false,
      error: null,
      isLoaded: true,
      isSignedIn: true,
      getToken,
      refreshUser: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
    })
  })

  afterEach(() => cleanup())

  it('renders role-scoped totals and recent work from the dashboard endpoint', async () => {
    const dashboard: AdminDashboard = {
      role: 'member',
      totals: { blogs: 3, blog_drafts: 1 },
      recent_work: [],
    }
    vi.mocked(getAdminDashboard).mockResolvedValue(dashboard)

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    await screen.findByText('3')
    expect(screen.getByText('1 drafts')).not.toBeNull()
    expect(screen.queryByText('Events')).toBeNull()
    expect(screen.queryByText('Sarah Jenkins')).toBeNull()
    await waitFor(() => expect(getAdminDashboard).toHaveBeenCalledWith(
      'session-token',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(getAdminDashboard).toHaveBeenCalledTimes(1)
  })

  it('keeps cached totals visible while a background refresh is pending', async () => {
    const cached: AdminDashboard = {
      role: 'member',
      totals: { blogs: 3, blog_drafts: 1 },
      recent_work: [],
    }
    let resolveRefresh!: (value: AdminDashboard) => void
    setResourceCache('dashboard', 'current', cached, 'management:member-1:clerk-member-1:member:active')
    vi.mocked(getAdminDashboard).mockReturnValue(
      new Promise((resolve) => { resolveRefresh = resolve }),
    )

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(screen.getByText('3')).not.toBeNull()
    expect(screen.queryByText('Loading dashboard...')).toBeNull()
    await waitFor(() => expect(getAdminDashboard).toHaveBeenCalledTimes(1))

    await act(async () => resolveRefresh({ ...cached, totals: { blogs: 4 } }))

    expect(screen.getByText('4')).not.toBeNull()
  })
})
