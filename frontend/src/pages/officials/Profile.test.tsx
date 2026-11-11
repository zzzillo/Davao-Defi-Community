import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppAuth } from '../../auth/useAppAuth'
import { updateMyProfile } from '../../services/userService'
import { uploadImage } from '../../services/storageService'
import type { UploadImageResult } from '../../services/storageService'
import type { AppUser } from '../../types/user'
import Profile from './Profile'

const mocks = vi.hoisted(() => ({ toast: vi.fn() }))

vi.mock('../../auth/useAppAuth', () => ({ useAppAuth: vi.fn() }))
vi.mock('../../hooks/useToast', () => ({ useToast: () => mocks.toast }))
vi.mock('../../services/userService', () => ({ updateMyProfile: vi.fn() }))
vi.mock('../../services/storageService', () => ({ uploadImage: vi.fn() }))

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

function uploadResult(storageKey: string): UploadImageResult {
  return {
    id: 'media-1',
    storage_key: storageKey,
    purpose: 'profile_photo',
    public_url: `https://media.example/${storageKey}`,
    content_type: 'image/png',
    byte_size: 12,
    width: 3,
    height: 2,
    validation_status: 'valid',
    image_key: storageKey,
    image_url: `https://media.example/${storageKey}`,
  }
}

const getToken = vi.fn(async () => 'session-token')
const refreshUser = vi.fn(async () => undefined)
let createObjectUrlDescriptor: PropertyDescriptor | undefined
let revokeObjectUrlDescriptor: PropertyDescriptor | undefined

describe('Profile page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getToken.mockResolvedValue('session-token')
    refreshUser.mockResolvedValue(undefined)
    createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:profile-preview') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    vi.mocked(useAppAuth).mockReturnValue({
      appUser: user,
      loading: false,
      error: null,
      isLoaded: true,
      isSignedIn: true,
      getToken,
      refreshUser,
      signOut: vi.fn(async () => undefined),
    })
    vi.mocked(uploadImage)
      .mockResolvedValueOnce(uploadResult('media/profile_photo/member-1/photo-a.webp'))
      .mockResolvedValueOnce(uploadResult('media/profile_photo/member-1/photo-b.webp'))
    vi.mocked(updateMyProfile).mockImplementation(async (payload) => {
      const key = payload.profile_photo_key ?? user.profile_photo_key
      return {
        ...user,
        display_name: payload.display_name ?? user.display_name,
        alias: payload.alias ?? user.alias,
        bio: payload.bio ?? user.bio,
        contributions: payload.contributions ?? user.contributions,
        social_links: payload.social_links ?? user.social_links,
        profile_photo_key: key,
        profile_photo_url: key ? `https://media.example/${key}` : user.profile_photo_url,
      }
    })
  })

  afterEach(() => {
    if (createObjectUrlDescriptor) Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor)
    else Reflect.deleteProperty(URL, 'createObjectURL')
    if (revokeObjectUrlDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor)
    else Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  it('uploads and saves the selected photo key, then clears it before the next photo intent', async () => {
    const { container } = render(<Profile />)
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')
    expect(fileInput).not.toBeNull()

    const firstPhoto = new File(['first'], 'first.png', { type: 'image/png' })
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [firstPhoto] } })
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Casey Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalledTimes(1))
    expect(uploadImage).toHaveBeenNthCalledWith(1, firstPhoto, 'session-token', { purpose: 'profile_photo' })
    expect(updateMyProfile).toHaveBeenNthCalledWith(1, {
      display_name: 'Casey Updated',
      alias: null,
      bio: null,
      contributions: [],
      social_links: {},
      profile_photo_key: 'media/profile_photo/member-1/photo-a.webp',
    }, 'session-token')

    const secondPhoto = new File(['second'], 'second.png', { type: 'image/png' })
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [secondPhoto] } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalledTimes(2))
    expect(uploadImage).toHaveBeenNthCalledWith(2, secondPhoto, 'session-token', { purpose: 'profile_photo' })
    expect(updateMyProfile).toHaveBeenNthCalledWith(2, expect.objectContaining({
      profile_photo_key: 'media/profile_photo/member-1/photo-b.webp',
    }), 'session-token')
    expect(refreshUser).toHaveBeenCalledTimes(2)
  })
})
