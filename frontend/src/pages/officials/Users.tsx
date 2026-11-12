import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { useAppAuth } from '../../auth/useAppAuth'
import { useToast } from '../../hooks/useToast'
import { useDebouncedSearchPagination } from '../../hooks/useDebouncedSearchPagination'
import { uploadImage } from '../../services/storageService'
import {
  createAdminInvitation,
  getAdminUser,
  listAdminInvitations,
  listAdminUsers,
  retryAdminInvitation,
  revokeAdminInvitation,
  updateAdminUserProfileAndDirectory,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '../../services/adminUserService'
import { ApiError } from '../../services/api'
import { useApiItem } from '../../hooks/useApiResource'
import {
  invalidateResource,
  managementResourceScope,
} from '../../services/resourceCache'
import type {
  AdminInvitation,
  AdminInvitationListResponse,
  AdminUserListResponse,
  AdminUserProfileAndDirectoryUpdate,
  InvitationCreate,
  InvitationProfileDetails,
  InvitationStatus,
} from '../../types/adminUser'
import type { AppRole, AppUser, AppUserStatus } from '../../types/user'

const roleOptions: { value: AppRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'official', label: 'Official' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Superadmin' },
]
const USER_PAGE_SIZE = 200
const INVITATION_PAGE_SIZE = 50

type UserListParams = {
  search?: string
  offset: number
}

type InvitationListParams = {
  status?: InvitationStatus
  offset: number
}

function fetchAdminUserList(
  serializedParams: string,
  options: { token?: string | null; signal?: AbortSignal },
): Promise<AdminUserListResponse> {
  if (!options.token) return Promise.reject(new ApiError(401, 'Please sign in to continue'))
  const params = JSON.parse(serializedParams) as UserListParams
  return listAdminUsers(
    { search: params.search, limit: USER_PAGE_SIZE, offset: params.offset },
    options as { token: string; signal?: AbortSignal },
  )
}

function fetchAdminInvitationList(
  serializedParams: string,
  options: { token?: string | null; signal?: AbortSignal },
): Promise<AdminInvitationListResponse> {
  if (!options.token) return Promise.reject(new ApiError(401, 'Please sign in to continue'))
  const params = JSON.parse(serializedParams) as InvitationListParams
  return listAdminInvitations(
    { status: params.status, limit: INVITATION_PAGE_SIZE, offset: params.offset },
    options as { token: string; signal?: AbortSignal },
  )
}

type UserDraft = {
  display_name: string
  alias: string
  bio: string
  contributions: string[]
  social_links: Record<string, string>
  positions_text: string
  directory_visible: boolean
  directory_order_text: string
  access_role: AppRole
  photo_file: File | null
  uploaded_photo_key: string | null
}

type AccessAction =
  | { kind: 'role'; user: AppUser; role: AppRole }
  | { kind: 'status'; user: AppUser; status: AppUserStatus }
  | { kind: 'revoke-invitation'; invitation: AdminInvitation }

const inputClass = 'h-10 w-full rounded-lg border border-outline bg-surface-lowest px-3 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none'
const textAreaClass = 'w-full resize-y rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none'

function roleLabel(role: AppRole): string {
  return roleOptions.find((option) => option.value === role)?.label ?? role
}

function parseList(value: string): string[] {
  return [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))]
}

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Could not reach the server. Check your connection and try again.'
  }
  const reason = error.details?.reason
  if (reason === 'directory_order_too_high') {
    const maximum = error.details?.max
    return typeof maximum === 'number'
      ? `Directory order cannot exceed ${maximum}.`
      : 'Directory order exceeds the current contributor count.'
  }
  const messages: Record<string, string> = {
    last_active_superadmin: 'At least one active superadmin must remain. Add or reactivate another superadmin before changing this account.',
    public_slug_immutable: 'This contributor URL is already public and cannot be changed.',
    public_slug_taken: 'That public contributor URL is already in use.',
    target_role_restricted: 'Your account cannot change access for this user.',
    cannot_manage_own_access: 'You cannot change your own access or account status.',
    clerk_identity_deleted: 'This sign-in identity was deleted and cannot be reactivated.',
    invitation_already_accepted: 'This invitation has been accepted. Suspend the account from the Users list instead.',
    invitation_not_deliverable: 'This invitation is expired or revoked and cannot be sent again.',
    active_invitation_exists: 'An active invitation already exists for this email address.',
    user_already_exists: 'An account already exists for this email address.',
    idempotency_key_reused: 'This invitation request key was already used for different details. Start a new invitation.',
  }
  const invitationId = error.details?.invitation_id
  if (error.status === 502 && typeof invitationId === 'string') {
    const lifecycle = typeof error.details?.status === 'string' ? error.details.status : 'uncertain'
    return `Delivery status is ${lifecycle}. The invitation has been refreshed below; use Retry to reconcile it before starting another invite.`
  }
  if (typeof reason === 'string' && messages[reason]) return messages[reason]
  return error.message
}

function userDraft(user: AppUser): UserDraft {
  return {
    display_name: user.display_name,
    alias: user.alias ?? '',
    bio: user.bio ?? '',
    contributions: [...user.contributions],
    social_links: { ...user.social_links },
    positions_text: user.positions.join(', '),
    directory_visible: user.show_in_contributor_directory,
    directory_order_text: user.contributor_directory_order == null ? '' : String(user.contributor_directory_order),
    access_role: user.role,
    photo_file: null,
    uploaded_photo_key: null,
  }
}

function directoryOrder(users: AppUser[], user: AppUser): number {
  if (user.contributor_directory_order !== null) return user.contributor_directory_order
  return users.filter((candidate) => candidate.show_in_contributor_directory && candidate.id !== user.id).length + 1
}

function asInvitationDetails(
  displayName: string,
  alias: string,
  bio: string,
  positions: string,
  contributions: string,
): InvitationProfileDetails | undefined {
  const parsedPositions = parseList(positions)
  const parsedContributions = contributions.split('\n').map((item) => item.trim()).filter(Boolean)
  const details: InvitationProfileDetails = {}
  if (displayName.trim()) details.display_name = displayName.trim()
  if (alias.trim()) details.alias = alias.trim()
  if (bio.trim()) details.bio = bio.trim()
  if (parsedPositions.length) details.positions = parsedPositions
  if (parsedContributions.length) details.contributions = parsedContributions
  return Object.keys(details).length ? details : undefined
}

export default function Users() {
  const { appUser, getToken, isLoaded, isSignedIn, loading: authLoading } = useAppAuth()
  const showToast = useToast()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const mutationBusy = useRef(false)
  const detailRequestId = useRef(0)
  const [userOverride, setUserOverride] = useState<{ key: string; source: AdminUserListResponse | null; items: AppUser[] } | null>(null)
  const [invitationOverride, setInvitationOverride] = useState<{ key: string; source: AdminInvitationListResponse | null; items: AdminInvitation[] } | null>(null)
  const [invitationOffset, setInvitationOffset] = useState(0)
  const [saving, setSaving] = useState(false)
  const { query, setQuery, search, page, setPage } = useDebouncedSearchPagination()
  const [invitationFilter, setInvitationFilter] = useState<'all' | InvitationStatus>('pending')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<UserDraft | null>(null)
  const [newContribution, setNewContribution] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AppRole>('member')
  const [inviteName, setInviteName] = useState('')
  const [inviteAlias, setInviteAlias] = useState('')
  const [inviteBio, setInviteBio] = useState('')
  const [invitePositions, setInvitePositions] = useState('')
  const [inviteContributions, setInviteContributions] = useState('')
  const [inviteKey, setInviteKey] = useState<string | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const [pendingAction, setPendingAction] = useState<AccessAction | null>(null)
  const lastPageError = useRef<string | null>(null)

  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin'
  const isSuperadmin = appUser?.role === 'superadmin'
  const managementScope = managementResourceScope(appUser, isSignedIn)
  const offset = (page - 1) * USER_PAGE_SIZE
  const userListParams: UserListParams = {
    search: search || undefined,
    offset,
  }
  const userRequestKey = JSON.stringify(userListParams)
  const invitationListParams: InvitationListParams = {
    status: invitationFilter === 'all' ? undefined : invitationFilter,
    offset: invitationOffset,
  }
  const invitationRequestKey = JSON.stringify(invitationListParams)
  const {
    item: userData,
    loading,
    error: userResourceError,
  } = useApiItem(fetchAdminUserList, userRequestKey, {
    management: true,
    enabled: Boolean(isLoaded && !authLoading && isSignedIn && isAdmin),
    resource: 'users',
  })
  function directoryOrderMaxFor(user: AppUser): number {
    const nextContributorSlot = user.show_in_contributor_directory ? 0 : 1
    return Math.max(1, (userData?.directory_order_count ?? 0) + nextContributorSlot)
  }
  const {
    item: invitationData,
    loading: invitationLoading,
    error: invitationResourceError,
  } = useApiItem(fetchAdminInvitationList, invitationRequestKey, {
    management: true,
    enabled: Boolean(isLoaded && !authLoading && isSignedIn && isAdmin),
    resource: 'users',
  })
  const users = userOverride?.key === userRequestKey && userOverride.source === userData
    ? userOverride.items
    : userData?.items ?? []
  const totalUsers = userData?.total ?? 0
  const invitations = invitationOverride?.key === invitationRequestKey && invitationOverride.source === invitationData
    ? invitationOverride.items
    : invitationData?.items ?? []
  const invitationTotal = invitationData?.total ?? 0
  const pageError = userResourceError || invitationResourceError
    ? errorMessage(userResourceError ?? invitationResourceError)
    : null

  useEffect(() => {
    if (pageError === null) {
      lastPageError.current = null
      return
    }
    if (lastPageError.current !== pageError) {
      showToast('error', pageError)
      lastPageError.current = pageError
    }
  }, [pageError, showToast])

  useEffect(() => {
    if (!inviteOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !invitePending) setInviteOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [inviteOpen, invitePending])

  const reload = useCallback(() => {
    invalidateResource('users', 'public')
    invalidateResource('users', managementScope)
    invalidateResource('dashboard', managementScope)
  }, [managementScope])

  function updateUserItems(update: AppUser[] | ((current: AppUser[]) => AppUser[])) {
    setUserOverride((current) => {
      const base = current?.key === userRequestKey && current.source === userData
        ? current.items
        : userData?.items ?? []
      return { key: userRequestKey, source: userData, items: typeof update === 'function' ? update(base) : update }
    })
  }

  function updateInvitationItems(update: AdminInvitation[] | ((current: AdminInvitation[]) => AdminInvitation[])) {
    setInvitationOverride((current) => {
      const base = current?.key === invitationRequestKey && current.source === invitationData
        ? current.items
        : invitationData?.items ?? []
      return { key: invitationRequestKey, source: invitationData, items: typeof update === 'function' ? update(base) : update }
    })
  }

  function beginEdit(user: AppUser) {
    const requestId = ++detailRequestId.current
    setEditingUserId(user.id)
    setEditDraft(userDraft(user))
    setNewContribution('')
    setDetailLoadingId(user.id)

    // The row already carries the cached profile fields, so the editor opens
    // without waiting for a Clerk token. Refresh details in the background;
    // only the row is updated, never the draft the admin may now be typing in.
    void (async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Your session has expired. Sign in again to continue.')
        const detail = await getAdminUser(user.id, { token })
        if (detailRequestId.current === requestId) {
          updateUserItems((current) => current.map((item) => item.id === detail.id ? detail : item))
        }
      } catch (caught) {
        if (detailRequestId.current === requestId) showToast('error', errorMessage(caught))
      } finally {
        if (detailRequestId.current === requestId) setDetailLoadingId(null)
      }
    })()
  }

  function stopEdit() {
    detailRequestId.current += 1
    setDetailLoadingId(null)
    setEditingUserId(null)
    setEditDraft(null)
    setNewContribution('')
  }

  function replaceUser(updated: AppUser) {
    updateUserItems((current) => current.map((user) => user.id === updated.id ? updated : user))
    setEditDraft((current) => current && editingUserId === updated.id ? { ...userDraft(updated) } : current)
    reload()
    reload()
  }

  function canManageAccess(user: AppUser): boolean {
    if (!appUser || user.id === appUser.id) return false
    if (isSuperadmin) return true
    return user.role === 'member' || user.role === 'official'
  }

  async function saveProfile(user: AppUser) {
    if (!editDraft || mutationBusy.current) return
    const displayName = editDraft.display_name.trim()
    if (!displayName) {
      showToast('error', 'Enter a display name before saving the profile.')
      return
    }
    const positions = parseList(editDraft.positions_text)
    if (positions.length > 2) {
      showToast('error', 'A contributor can have up to two positions.')
      return
    }
    if (positions.some((position) => position.length > 80)) {
      showToast('error', 'Each position must be 80 characters or fewer.')
      return
    }
    const parsedOrder = editDraft.directory_order_text.trim() === ''
      ? null
      : Number(editDraft.directory_order_text)
    if (parsedOrder !== null && (!Number.isInteger(parsedOrder) || parsedOrder < 1)) {
      showToast('error', 'Directory order must be a whole number of one or more.')
      return
    }
    const maxDirectoryOrder = directoryOrderMaxFor(user)
    if (parsedOrder !== null && parsedOrder > maxDirectoryOrder) {
      showToast('error', `Directory order cannot exceed ${maxDirectoryOrder}.`)
      return
    }
    const assignedDirectoryOrder = editDraft.directory_visible
      ? parsedOrder ?? user.contributor_directory_order ?? (user.show_in_contributor_directory
        ? Math.max(1, userData?.directory_order_count ?? 0)
        : (userData?.directory_order_count ?? 0) + 1)
      : null
    mutationBusy.current = true
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Your session has expired. Sign in again to continue.')
      let profilePhotoKey: string | undefined
      if (editDraft.photo_file) {
        if (editDraft.uploaded_photo_key) profilePhotoKey = editDraft.uploaded_photo_key
        else {
          const upload = await uploadImage(editDraft.photo_file, token, {
            purpose: 'profile_photo',
            ownerUserId: user.id,
          })
          profilePhotoKey = upload.storage_key
          setEditDraft((current) => current ? { ...current, uploaded_photo_key: upload.storage_key } : current)
        }
      }
      const contributions = editDraft.contributions.map((item) => item.trim()).filter(Boolean)
      const socialLinks = Object.fromEntries(
        Object.entries(editDraft.social_links).map(([key, value]) => [key.trim(), value.trim()])
          .filter(([key, value]) => key !== '' && value !== ''),
      )
      const payload: AdminUserProfileAndDirectoryUpdate = {
        display_name: displayName,
        alias: editDraft.alias.trim() || null,
        bio: editDraft.bio.trim() || null,
        contributions,
        social_links: socialLinks,
        positions,
        show_in_contributor_directory: editDraft.directory_visible,
        contributor_directory_order: assignedDirectoryOrder,
      }
      if (profilePhotoKey) payload.profile_photo_key = profilePhotoKey
      const updated = await updateAdminUserProfileAndDirectory(user.id, payload, { token })
      replaceUser(updated)
      showToast('success', 'Profile saved')
      stopEdit()
    } catch (caught) {
      showToast('error', errorMessage(caught))
    } finally {
      mutationBusy.current = false
      setSaving(false)
    }
  }

  async function runAccessAction() {
    if (!pendingAction || mutationBusy.current) return
    mutationBusy.current = true
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Your session has expired. Sign in again to continue.')
      if (pendingAction.kind === 'role') {
        const updated = await updateAdminUserRole(pendingAction.user.id, pendingAction.role, { token })
        replaceUser(updated)
        showToast('success', `Access changed to ${roleLabel(updated.role)}`)
      } else if (pendingAction.kind === 'status') {
        const updated = await updateAdminUserStatus(pendingAction.user.id, pendingAction.status, { token })
        replaceUser(updated)
        showToast('success', updated.status === 'active' ? 'Account reactivated' : 'Account suspended')
      } else {
        const updated = await revokeAdminInvitation(pendingAction.invitation.id, { token })
        updateInvitationItems((current) => current.map((invitation) => invitation.id === updated.id ? updated : invitation))
        setInvitationFilter('all')
        setInvitationOffset(0)
        reload()
        showToast('success', 'Invitation revoked')
      }
      setPendingAction(null)
    } catch (caught) {
      showToast('error', errorMessage(caught))
      if (pendingAction.kind === 'revoke-invitation') reload()
    } finally {
      mutationBusy.current = false
      setSaving(false)
    }
  }

  function updateInviteField(setter: (value: string) => void, value: string) {
    setter(value)
    setInviteKey(null)
  }

  async function submitInvitation() {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) {
      showToast('error', 'Enter an email address.')
      return
    }
    const positions = parseList(invitePositions)
    const contributions = inviteContributions.split('\n').map((item) => item.trim()).filter(Boolean)
    if (positions.length > 2) {
      showToast('error', 'A new contributor can have up to two positions.')
      return
    }
    if (contributions.length > 50) {
      showToast('error', 'Enter no more than 50 contributions.')
      return
    }
    setInvitePending(true)
    const idempotencyKey = inviteKey ?? crypto.randomUUID()
    setInviteKey(idempotencyKey)
    try {
      const token = await getToken()
      if (!token) throw new Error('Your session has expired. Sign in again to continue.')
      const profileDetails = asInvitationDetails(inviteName, inviteAlias, inviteBio, invitePositions, inviteContributions)
      const payload: InvitationCreate = {
        email,
        role: inviteRole,
        ...(profileDetails ? { profile_details: profileDetails } : {}),
      }
      const result = await createAdminInvitation(payload, idempotencyKey, { token })
      showToast('success', `Invitation status: ${result.status}`)
      setInviteEmail('')
      setInviteRole('member')
      setInviteName('')
      setInviteAlias('')
      setInviteBio('')
      setInvitePositions('')
      setInviteContributions('')
      setInviteKey(null)
      setInviteOpen(false)
      setInvitationFilter('all')
      setInvitationOffset(0)
      reload()
    } catch (caught) {
      showToast('error', errorMessage(caught))
      if (caught instanceof ApiError && caught.status === 502) {
        setInvitationFilter('all')
        setInvitationOffset(0)
        reload()
      }
    } finally {
      setInvitePending(false)
    }
  }

  async function retryInvitation(invitation: AdminInvitation) {
    if (mutationBusy.current) return
    mutationBusy.current = true
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Your session has expired. Sign in again to continue.')
      const updated = await retryAdminInvitation(invitation.id, { token })
      updateInvitationItems((current) => current.map((item) => item.id === updated.id ? updated : item))
      setInvitationFilter('all')
      setInvitationOffset(0)
      reload()
      showToast('success', `Invitation status: ${updated.status}`)
    } catch (caught) {
      showToast('error', errorMessage(caught))
      if (caught instanceof ApiError && caught.status === 502) {
        setInvitationFilter('all')
        setInvitationOffset(0)
      }
      reload()
    } finally {
      mutationBusy.current = false
      setSaving(false)
    }
  }

  function updateDraft(patch: Partial<UserDraft>) {
    setEditDraft((current) => current ? { ...current, ...patch } : current)
  }

  const inviteRoleOptions = isSuperadmin ? roleOptions : roleOptions.slice(0, 2)
  const matchingInvitations = invitations


  const contributorUsers = users.filter((user) => user.show_in_contributor_directory)
  const nonContributorUsers = users.filter((user) => !user.show_in_contributor_directory)
  const pageSize = USER_PAGE_SIZE

  function renderAccountRows(groupUsers: AppUser[], emptyMessage: string) {
    return (
      <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">Loading accounts...</td></tr>
              ) : groupUsers.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">{emptyMessage}</td></tr>
              ) : groupUsers.map((user) => {
                const isEditing = editingUserId === user.id && editDraft !== null
                const self = user.id === appUser?.id
                const mayManageAccess = canManageAccess(user)
                const order = directoryOrder(users, user)
                return (
                  <Fragment key={user.id}>
                    <tr className={`border-b border-outline last:border-0 hover:bg-surface-low ${user.status === 'suspended' ? 'opacity-70' : ''}`}>
                      <td className="px-3 py-4 text-center align-top text-sm font-medium tabular-nums text-muted">{user.show_in_contributor_directory ? user.contributor_directory_order ?? order : '—'}</td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container text-muted">
                            {user.profile_photo_url ? <img src={user.profile_photo_url} alt="" className="h-full w-full object-cover" /> : <Icon name="person" className="text-[20px]" />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-on-surface">{user.display_name}</p>
                            <p className="truncate text-xs text-muted">{user.email ?? 'Email not available'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-on-surface-variant">{user.positions.length ? user.positions.join(', ') : <span className="text-muted">No position</span>}</td>
                      <td className="px-4 py-4 align-top text-sm text-on-surface-variant">{roleLabel(user.role)}</td>
                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${user.show_in_contributor_directory ? 'bg-success/10 text-success' : 'bg-surface-container text-on-surface-variant'}`}>
                          {user.show_in_contributor_directory ? 'Public contributor' : 'Private profile'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${user.status === 'active' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                          {user.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" aria-label={`Edit ${user.display_name}`} title="Edit profile" disabled={saving} onClick={() => isEditing ? stopEdit() : beginEdit(user)} className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-50"><Icon name={isEditing ? 'close' : detailLoadingId === user.id ? 'progress_activity' : 'edit'} className="text-[19px]" /></button>
                          {mayManageAccess && (
                            <button type="button" disabled={saving} aria-label={user.status === 'active' ? `Suspend ${user.display_name}` : `Reactivate ${user.display_name}`} title={user.status === 'active' ? 'Suspend account' : 'Reactivate account'} onClick={() => setPendingAction({ kind: 'status', user, status: user.status === 'active' ? 'suspended' : 'active' })} className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-container disabled:opacity-50 ${user.status === 'active' ? 'text-error' : 'text-success'}`}><Icon name={user.status === 'active' ? 'block' : 'check_circle'} className="text-[19px]" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isEditing && editDraft && (
                      <tr className="border-b border-outline bg-surface">
                        <td colSpan={7} className="px-5 py-5">
                          <fieldset disabled={saving} className="contents" aria-busy={saving}>
                          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-on-surface">Edit {user.display_name}</h3>
                              <p className="text-xs text-muted">Email and account identity stay read-only. Profile and directory changes are saved together.</p>
                            </div>
                            <span className="text-xs text-muted">{user.public_slug ? `Public URL: /contributors/${user.public_slug}` : 'No public contributor URL yet'}</span>
                          </div>

                          <div className="grid gap-5 lg:grid-cols-3">
                            <div className="flex flex-col gap-4">
                              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Display name
                                <input type="text" value={editDraft.display_name} onChange={(event) => updateDraft({ display_name: event.target.value })} className={inputClass} maxLength={120} />
                              </label>
                              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Email
                                <input type="email" value={user.email ?? ''} readOnly className={`${inputClass} cursor-not-allowed bg-surface-low text-muted`} />
                              </label>
                              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Alias
                                <input type="text" value={editDraft.alias} onChange={(event) => updateDraft({ alias: event.target.value })} className={inputClass} maxLength={80} />
                              </label>
                              <div className="flex flex-col gap-2">
                                <span className="text-sm font-medium text-on-surface">Profile photo</span>
                                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; event.target.value = ''; if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { showToast('error', 'Choose a JPEG, PNG, or WebP image.'); return }; updateDraft({ photo_file: file, uploaded_photo_key: null }) }} className="block w-full text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-container file:px-3 file:py-2 file:text-xs file:font-semibold file:text-on-surface" />
                                {(editDraft.photo_file || user.profile_photo_url) && <p className="text-xs text-muted">{editDraft.photo_file?.name ?? 'Current photo is saved.'}</p>}
                              </div>
                            </div>

                            <div className="flex flex-col gap-4">
                              <fieldset>
                                <legend className="mb-1.5 text-sm font-semibold text-on-surface">Access role</legend>
                                <div className="flex gap-2">
                                  <select value={editDraft.access_role} disabled={!mayManageAccess} onChange={(event) => updateDraft({ access_role: event.target.value as AppRole })} className={`${inputClass} min-w-0 flex-1 disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-muted`}>
                                    {(isSuperadmin ? roleOptions : roleOptions.slice(0, 2)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    {!(isSuperadmin ? roleOptions : roleOptions.slice(0, 2)).some((option) => option.value === user.role) && <option value={user.role}>{roleLabel(user.role)}</option>}
                                  </select>
                                  <button type="button" disabled={!mayManageAccess || saving || editDraft.access_role === user.role} onClick={() => setPendingAction({ kind: 'role', user, role: editDraft.access_role })} className="rounded-lg border border-outline px-3 text-xs font-semibold text-on-surface hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-50">Save role</button>
                                </div>
                                <p className="mt-1.5 text-xs text-muted">{self ? 'You cannot change your own access.' : mayManageAccess ? 'One account role controls access to modules.' : 'Your role cannot change this account’s access.'}</p>
                              </fieldset>
                              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Positions
                                <input type="text" value={editDraft.positions_text} onChange={(event) => updateDraft({ positions_text: event.target.value })} placeholder="Builder, Partnerships" className={inputClass} />
                                <span className="text-xs font-normal text-muted">Up to two values, separated by commas.</span>
                              </label>
                              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Contributor directory order
                                <input type="number" min={1} max={directoryOrderMaxFor(user)} step={1} value={editDraft.directory_order_text} onChange={(event) => {
                                  const value = event.target.value
                                  const numericValue = Number(value)
                                  const maximum = directoryOrderMaxFor(user)
                                  updateDraft({
                                    directory_order_text: value !== '' && Number.isFinite(numericValue) && numericValue > maximum
                                      ? String(maximum)
                                      : value,
                                  })
                                }} disabled={!editDraft.directory_visible} className={`${inputClass} disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-muted`} />
                                <span className="text-xs font-normal text-muted">Use a position from 1 to {directoryOrderMaxFor(user)}. Leave blank to add a contributor at the end.</span>
                              </label>
                              <label className="flex items-center gap-3 rounded-lg border border-outline bg-surface-lowest px-3 py-3 text-sm font-medium text-on-surface">
                                <input type="checkbox" checked={editDraft.directory_visible} onChange={(event) => updateDraft({ directory_visible: event.target.checked })} className="h-4 w-4 accent-current" />
                                Show in public contributor directory
                              </label>
                            </div>

                            <div className="flex flex-col gap-4">
                              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Bio / Description
                                <textarea value={editDraft.bio} onChange={(event) => updateDraft({ bio: event.target.value })} rows={4} className={`${textAreaClass} min-h-28`} maxLength={4000} />
                              </label>
                              <fieldset>
                                <legend className="mb-1.5 text-sm font-semibold text-on-surface">Contributions</legend>
                                <div className="flex flex-col gap-1 rounded-lg border border-outline bg-surface-lowest px-3 py-2">
                                  {editDraft.contributions.map((contribution, index) => (
                                    <label key={index} className="flex items-center gap-2">
                                      <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant" />
                                      <input type="text" value={contribution} onChange={(event) => updateDraft({ contributions: editDraft.contributions.map((item, itemIndex) => index === itemIndex ? event.target.value : item) })} placeholder="Describe a contribution" className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-sm text-on-surface placeholder:text-muted focus:bg-surface-low focus:outline-none" />
                                      <button type="button" aria-label={`Remove contribution ${index + 1}`} onClick={() => updateDraft({ contributions: editDraft.contributions.filter((_, itemIndex) => itemIndex !== index) })} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-low"><Icon name="close" className="text-[17px]" /></button>
                                    </label>
                                  ))}
                                  <label className="flex items-center gap-2">
                                    <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant" />
                                    <input type="text" value={newContribution} onChange={(event) => setNewContribution(event.target.value)} placeholder="Add a contribution..." className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-sm text-on-surface placeholder:text-muted focus:bg-surface-low focus:outline-none" />
                                    {newContribution.trim() && <button type="button" aria-label="Add contribution" onClick={() => { updateDraft({ contributions: [...editDraft.contributions, newContribution.trim()] }); setNewContribution('') }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-low"><Icon name="add" /></button>}
                                  </label>
                                </div>
                              </fieldset>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-outline pt-4">
                            <button type="button" onClick={stopEdit} disabled={saving} className="rounded-lg border border-outline bg-surface-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low disabled:opacity-50">Close</button>
                            <button type="button" onClick={() => void saveProfile(user)} disabled={saving} className="flex items-center gap-2 rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50"><Icon name={saving ? 'progress_activity' : 'save'} className="text-[18px]" />Save profile</button>
                          </div>
                          </fieldset>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
    )
  }

  function renderAccountGroup(title: string, groupUsers: AppUser[], emptyMessage: string) {
    return (
      <section className="overflow-hidden rounded-xl border border-outline bg-surface-lowest">
        <div className="border-b border-outline bg-surface px-5 py-4">
          <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
          <p className="text-xs text-muted">{groupUsers.length} {groupUsers.length === 1 ? 'account' : 'accounts'} on this page</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-outline bg-surface text-xs font-semibold uppercase tracking-wider text-muted">
                <th className="w-[6%] px-3 py-4 text-center font-semibold">#</th>
                <th className="w-[25%] px-5 py-4 font-semibold">User</th>
                <th className="w-[16%] px-4 py-4 font-semibold">Position</th>
                <th className="w-[14%] px-4 py-4 font-semibold">Access</th>
                <th className="w-[17%] px-4 py-4 font-semibold">Directory</th>
                <th className="w-[12%] px-4 py-4 font-semibold">Status</th>
                <th className="w-[10%] px-4 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            {renderAccountRows(groupUsers, emptyMessage)}
          </table>
        </div>
      </section>
    )
  }

  if (authLoading || !isLoaded) {
    return <div className="flex flex-col gap-5"><PageHeader title="Users" subtitle="Manage accounts, access and contributor profiles." /><p className="rounded-xl border border-outline bg-surface-lowest px-5 py-10 text-center text-sm text-muted">Loading access...</p></div>
  }

  if (!isAdmin) {
    return <div className="flex flex-col gap-5"><PageHeader title="Users" subtitle="Manage accounts, access and contributor profiles." /><div role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">You do not have permission to manage users.</div></div>
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Users"
        subtitle="Manage account access and contributor profiles."
        actionLabel="Invite User"
        onAction={() => setInviteOpen(true)}
        iconOnlyOnMobile
      />

      {pageError && (
        <div className="flex justify-end">
          <button type="button" onClick={reload} className="rounded-md px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-low">Retry loading users and invitations</button>
        </div>
      )}

      <label className="relative block w-full sm:ml-auto sm:w-72">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted" />
        <span className="sr-only">Search accounts</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accounts..." className="h-10 w-full rounded-lg border border-outline bg-surface-lowest pl-10 pr-4 text-sm text-on-surface placeholder:text-muted focus:outline-none" />
      </label>
      {renderAccountGroup('Contributor accounts', contributorUsers, search ? `No contributor accounts match “${search}”.` : 'No contributor accounts yet.')}
      {renderAccountGroup('Non-contributor accounts', nonContributorUsers, search ? `No non-contributor accounts match “${search}”.` : 'No non-contributor accounts yet.')}
      {!loading && totalUsers > pageSize && (
        <div className="flex items-center justify-between rounded-xl border border-outline bg-surface-lowest px-5 py-3 text-sm text-muted">
          <span>Showing {offset + 1}–{Math.min(offset + users.length, totalUsers)} of {totalUsers}</span>
          <div className="flex gap-2">
            <button type="button" disabled={offset === 0} onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} className="rounded-md border border-outline px-3 py-1.5 font-medium text-on-surface disabled:opacity-40">Previous</button>
            <button type="button" disabled={offset + pageSize >= totalUsers} onClick={() => setPage((currentPage) => currentPage + 1)} className="rounded-md border border-outline px-3 py-1.5 font-medium text-on-surface disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-outline bg-surface-lowest">
        <div className="border-b border-outline bg-surface px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Invitations</h2>
              <p className="text-xs text-muted">{invitationTotal} {invitationTotal === 1 ? 'invitation' : 'invitations'}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="sr-only">Filter invitations by status</span>
              <select value={invitationFilter} onChange={(event) => { setInvitationFilter(event.target.value as 'all' | InvitationStatus); setInvitationOffset(0) }} className="h-9 rounded-lg border border-outline bg-surface-lowest px-3 text-sm text-on-surface focus:outline-none">
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="accepted">Accepted</option>
                <option value="revoked">Revoked</option>
                <option value="expired">Expired</option>
              </select>
            </label>
          </div>
        </div>
      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !invitePending) setInviteOpen(false)
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-outline bg-surface-lowest shadow-float sm:max-h-[calc(100dvh-3rem)]">
            <div className="flex items-start justify-between gap-4 border-b border-outline bg-surface px-5 py-4">
              <div>
                <h2 id="invite-dialog-title" className="text-lg font-semibold text-on-surface">Invite a user</h2>
                <p className="mt-0.5 text-sm text-muted">The invitation is sent by the server and access is assigned after acceptance.</p>
              </div>
              <button type="button" aria-label="Close invite dialog" disabled={invitePending} onClick={() => setInviteOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-low disabled:opacity-50">
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
                  <fieldset disabled={invitePending} className="contents" aria-busy={invitePending}>
                  <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">
                <span>Email <span className="text-error">*</span></span>
                <input type="email" value={inviteEmail} onChange={(event) => updateInviteField(setInviteEmail, event.target.value)} placeholder="person@example.com" className={inputClass} autoComplete="email" autoFocus />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">
                Access role
                <select value={inviteRole} onChange={(event) => { setInviteRole(event.target.value as AppRole); setInviteKey(null) }} className={inputClass}>
                  {inviteRoleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">
                Display name <span className="font-normal text-muted">Optional</span>
                <input type="text" value={inviteName} onChange={(event) => updateInviteField(setInviteName, event.target.value)} className={inputClass} maxLength={120} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">
                Alias <span className="font-normal text-muted">Optional</span>
                <input type="text" value={inviteAlias} onChange={(event) => updateInviteField(setInviteAlias, event.target.value)} className={inputClass} maxLength={80} />
              </label>
            </div>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">
                Position(s) <span className="font-normal text-muted">Optional · up to two, separated by commas</span>
                <input type="text" value={invitePositions} onChange={(event) => updateInviteField(setInvitePositions, event.target.value)} className={inputClass} maxLength={161} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">
                Bio <span className="font-normal text-muted">Optional</span>
                <textarea value={inviteBio} onChange={(event) => updateInviteField(setInviteBio, event.target.value)} rows={3} className={textAreaClass} maxLength={4000} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">
                Contributions <span className="font-normal text-muted">Optional · one per line</span>
                <textarea value={inviteContributions} onChange={(event) => updateInviteField(setInviteContributions, event.target.value)} rows={3} className={textAreaClass} />
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-outline px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">A retry keeps the same request key until these details change.</p>
            <button type="button" disabled={invitePending} onClick={() => void submitInvitation()} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-btn px-5 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60">
              <Icon name={invitePending ? 'progress_activity' : 'mail'} className="text-[18px]" />
              {invitePending ? 'Sending...' : 'Send invitation'}
            </button>
          </div>
          </fieldset>
          </section>
        </div>
      )}
        {invitationLoading ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Loading invitations...</p>
        ) : matchingInvitations.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No invitations in this status.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-outline text-xs font-semibold uppercase tracking-wider text-muted"><th className="px-5 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Attempts</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {matchingInvitations.map((invitation) => (
                  <tr key={invitation.id} className="border-b border-outline last:border-0">
                    <td className="px-5 py-4 font-medium text-on-surface">{invitation.email}</td>
                    <td className="px-4 py-4 text-on-surface-variant">{roleLabel(invitation.assigned_role)}</td>
                    <td className="px-4 py-4"><span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium capitalize text-on-surface-variant">{invitation.status}</span></td>
                    <td className="px-4 py-4 text-on-surface-variant" title={invitation.created_at}>{new Date(invitation.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-4 text-on-surface-variant">{invitation.delivery_attempts}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(invitation.status === 'failed' || invitation.status === 'pending') && (
                          <button type="button" disabled={saving || invitePending} onClick={() => void retryInvitation(invitation)} className="rounded-md border border-outline px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-low disabled:opacity-50">Retry / check</button>
                        )}
                        {(invitation.status === 'failed' || invitation.status === 'pending') && (
                          <button type="button" disabled={saving || invitePending} onClick={() => setPendingAction({ kind: 'revoke-invitation', invitation })} className="rounded-md px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/10 disabled:opacity-50">Revoke</button>
                        )}
                        {invitation.status === 'accepted' && <span className="text-xs text-muted">Invitation accepted</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!invitationLoading && invitationTotal > INVITATION_PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-outline px-5 py-3 text-sm text-muted">
            <span>Showing {invitationOffset + 1}–{Math.min(invitationOffset + invitations.length, invitationTotal)} of {invitationTotal}</span>
            <div className="flex gap-2">
              <button type="button" disabled={invitationOffset === 0} onClick={() => setInvitationOffset(Math.max(0, invitationOffset - INVITATION_PAGE_SIZE))} className="rounded-md border border-outline px-3 py-1.5 font-medium text-on-surface disabled:opacity-40">Previous</button>
              <button type="button" disabled={invitationOffset + INVITATION_PAGE_SIZE >= invitationTotal} onClick={() => setInvitationOffset(invitationOffset + INVITATION_PAGE_SIZE)} className="rounded-md border border-outline px-3 py-1.5 font-medium text-on-surface disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.kind === 'role' ? 'Change account access?' : pendingAction?.kind === 'status' ? (pendingAction.status === 'suspended' ? 'Suspend account?' : 'Reactivate account?') : 'Revoke invitation?'}
        message={pendingAction?.kind === 'role'
          ? `Change ${pendingAction.user.display_name} to ${roleLabel(pendingAction.role)}? This updates their application access.`
          : pendingAction?.kind === 'status'
            ? pendingAction.status === 'suspended'
              ? `Suspend ${pendingAction.user.display_name}? Their authored content and activity history will remain.`
              : `Reactivate ${pendingAction.user.display_name}? They will regain access if their sign-in identity is still valid.`
            : pendingAction?.kind === 'revoke-invitation'
              ? `Revoke the invitation for ${pendingAction.invitation.email}? This closes onboarding for that invitation.`
              : ''}
        confirmLabel={pendingAction?.kind === 'status' && pendingAction.status === 'active' ? 'Reactivate' : pendingAction?.kind === 'revoke-invitation' ? 'Revoke' : pendingAction?.kind === 'status' ? 'Suspend' : 'Change role'}
        onCancel={() => { if (!saving) setPendingAction(null) }}
        onConfirm={() => void runAccessAction()}
      />
    </div>
  )
}
