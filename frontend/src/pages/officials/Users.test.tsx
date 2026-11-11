import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '../../services/api'
import type { AppUser } from '../../types/user'
import type { AdminInvitation, AdminInvitationListResponse, AdminUserListResponse } from '../../types/adminUser'
import { useAppAuth } from '../../auth/useAppAuth'
import {
  createAdminInvitation,
  getAdminUser,
  listAdminInvitations,
  listAdminUsers,
  updateAdminUserRole,
} from '../../services/adminUserService'
import Users from './Users'

const mocks = vi.hoisted(() => ({ toast: vi.fn() }))

vi.mock('../../auth/useAppAuth', () => ({ useAppAuth: vi.fn() }))
vi.mock('../../hooks/useToast', () => ({ useToast: () => mocks.toast }))
vi.mock('../../services/adminUserService', () => ({
  createAdminInvitation: vi.fn(),
  getAdminUser: vi.fn(),
  listAdminInvitations: vi.fn(),
  listAdminUsers: vi.fn(),
  retryAdminInvitation: vi.fn(),
  revokeAdminInvitation: vi.fn(),
  updateAdminUserDirectory: vi.fn(),
  updateAdminUserProfile: vi.fn(),
  updateAdminUserRole: vi.fn(),
  updateAdminUserStatus: vi.fn(),
}))

function appUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: 'member-1',
    clerk_user_id: 'clerk-member-1',
    first_name: null,
    last_name: null,
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
    ...overrides,
  }
}

function invitation(overrides: Partial<AdminInvitation> = {}): AdminInvitation {
  return {
    id: 'invitation-1',
    email: 'new@example.com',
    assigned_role: 'member',
    status: 'failed',
    created_at: '2026-11-10T07:00:00Z',
    expires_at: '2026-11-17T07:00:00Z',
    accepted_at: null,
    failed_at: '2026-11-10T07:01:00Z',
    delivery_attempts: 1,
    ...overrides,
  }
}

const getToken = vi.fn(async () => 'session-token')

function setAuth(role: AppUser['role'] = 'admin') {
  vi.mocked(useAppAuth).mockReturnValue({
    appUser: appUser({ id: 'actor-1', display_name: 'Signed-in Admin', role }),
    loading: false,
    error: null,
    isLoaded: true,
    isSignedIn: true,
    getToken,
    refreshUser: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  })
}

describe('Users admin page', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getToken.mockResolvedValue('session-token')
    setAuth()
    vi.mocked(listAdminUsers).mockResolvedValue({ items: [], total: 0 } satisfies AdminUserListResponse)
    vi.mocked(listAdminInvitations).mockResolvedValue({ items: [], total: 0 } satisfies AdminInvitationListResponse)
  })

  it('uses the database role hierarchy and allows admins to promote a member', async () => {
    const member = appUser()
    const peerAdmin = appUser({
      id: 'peer-admin',
      clerk_user_id: 'clerk-peer-admin',
      display_name: 'Peer Admin',
      email: 'peer@example.com',
      role: 'admin',
    })
    vi.mocked(listAdminUsers).mockResolvedValue({ items: [member, peerAdmin], total: 2 })
    vi.mocked(getAdminUser).mockImplementation(async (id) => id === member.id ? member : peerAdmin)
    vi.mocked(updateAdminUserRole).mockResolvedValue({ ...member, role: 'official' })

    render(<MemoryRouter><Users /></MemoryRouter>)
    await screen.findByRole('row', { name: /Casey Member/ })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Casey Member' }))
    await screen.findByText('Edit Casey Member')
    const roleSelect = screen.getByDisplayValue('Member')
    expect((roleSelect as HTMLSelectElement).disabled).toBe(false)
    fireEvent.change(roleSelect, { target: { value: 'official' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save role' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change role' }))

    await waitFor(() => expect(updateAdminUserRole).toHaveBeenCalledWith('member-1', 'official', { token: 'session-token' }))

    fireEvent.click(screen.getByRole('button', { name: 'Edit Peer Admin' }))
    await screen.findByText('Edit Peer Admin')
    expect((screen.getByDisplayValue('Admin') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Suspend Peer Admin' })).toBeNull()
  })

  it('shows an uncertain invitation as a status error and refreshes the lifecycle list', async () => {
    const failed = invitation({ id: 'invite-uncertain', email: 'person@example.com' })
    vi.mocked(listAdminInvitations)
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValue({ items: [failed], total: 1 })
    vi.mocked(createAdminInvitation).mockRejectedValueOnce(new ApiError(
      502,
      'Request failed (502)',
      'invitation_delivery_uncertain',
      [],
      { reason: 'invitation_delivery_uncertain', invitation_id: failed.id, status: 'failed' },
    ))
    vi.stubGlobal('crypto', { randomUUID: () => 'stable-invitation-intent' })

    render(<MemoryRouter><Users /></MemoryRouter>)
    await screen.findByRole('heading', { name: 'Accounts' })
    fireEvent.click(screen.getByRole('button', { name: 'Invite User' }))
    fireEvent.change(screen.getByPlaceholderText('person@example.com'), { target: { value: 'PERSON@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))

    await screen.findAllByText(/Delivery status is failed/)
    await screen.findByText('person@example.com')
    expect(createAdminInvitation).toHaveBeenCalledWith(
      { email: 'person@example.com', role: 'member' },
      'stable-invitation-intent',
      { token: 'session-token' },
    )
    expect(listAdminInvitations).toHaveBeenCalledTimes(2)
    expect(mocks.toast).not.toHaveBeenCalledWith('success', expect.anything())
    expect(screen.getByRole('button', { name: 'Retry / check' })).not.toBeNull()
  })
})
