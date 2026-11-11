import { useEffect, useRef, useState } from 'react'

import ActivityFeed from '../../components/activity/ActivityFeed'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { useAppAuth } from '../../auth/useAppAuth'
import { useActivityLogs } from '../../hooks/useActivityLogs'
import { useToastError } from '../../hooks/useToast'
import { listAdminUsers } from '../../services/adminUserService'
import type { AppUser } from '../../types/user'
import type { ActivityAction, ActivityResource } from '../../types/activityLog'

const PAGE_SIZE = 25

const RESOURCES: { value: ActivityResource | ''; label: string }[] = [
  { value: '', label: 'Everything' },
  { value: 'event', label: 'Events' },
  { value: 'post', label: 'Recaps' },
  { value: 'blog', label: 'Blogs' },
  { value: 'partner', label: 'Partners' },
  { value: 'user', label: 'Users' },
  { value: 'media', label: 'Media' },
]

const ACTIONS: { value: ActivityAction | ''; label: string }[] = [
  { value: '', label: 'Any action' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'published', label: 'Published' },
  { value: 'unpublished', label: 'Unpublished' },
  { value: 'promoted', label: 'Promoted' },
  { value: 'demoted', label: 'Demoted' },
  { value: 'updated_permissions', label: 'Permissions changed' },
  { value: 'updated_profile', label: 'Profile updated' },
  { value: 'updated_directory', label: 'Directory updated' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'reactivated', label: 'Reactivated' },
]

/**
 * The audit trail.
 *
 * This page used to do two unrelated jobs: a mock activity feed AND a mock
 * user-permissions table with role dropdowns and checkboxes. The second was
 * user management, which belongs at /admin/users, and has moved there. A page
 * doing two things is how a mock's invented fields survive into a real module.
 *
 * Read-only, because the API is. There is no create, no edit, no delete, and
 * no bulk action - an audit trail somebody can change is not one.
 */
export default function Activity() {
  const { appUser, getToken, isLoaded, isSignedIn } = useAppAuth()
  const [resource, setResource] = useState<ActivityResource | ''>('')
  const [action, setAction] = useState<ActivityAction | ''>('')
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState<AppUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [resourceOpen, setResourceOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const resourceRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !appUser) return

    let cancelled = false
    async function loadUsers() {
      setUsersLoading(true)
      try {
        const token = await getToken()
        if (!token) return
        const result = await listAdminUsers({ limit: 200 }, { token })
        if (!cancelled) setUsers(result.items)
      } catch {
        if (!cancelled) setUsers([])
      } finally {
        if (!cancelled) setUsersLoading(false)
      }
    }

    void loadUsers()
    return () => { cancelled = true }
  }, [appUser, getToken, isLoaded, isSignedIn])

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (resourceRef.current && !resourceRef.current.contains(target)) setResourceOpen(false)
      if (actionRef.current && !actionRef.current.contains(target)) setActionOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const { entries, total, hasNext, loading, error, reload } = useActivityLogs({
    // Empty means "no filter", and toQueryString drops empty strings - so the
    // dropdowns' blank option needs no special case here.
    resource: resource || undefined,
    action: action || undefined,
    user_id: userId || undefined,
    limit: PAGE_SIZE,
    offset,
  })
  useToastError(error)

  // Changing a filter while on page 3 would ask for results 50-75 of a set that
  // may only have four. Resetting during render keeps the two in step without
  // an effect that would fetch the wrong page first and correct itself after.
  const [filteredBy, setFilteredBy] = useState(`${resource}|${action}|${userId}`)

  if (filteredBy !== `${resource}|${action}|${userId}`) {
    setFilteredBy(`${resource}|${action}|${userId}`)
    setOffset(0)
  }

  const showingFrom = total === 0 ? 0 : offset + 1
  const showingTo = offset + entries.length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Activity"
        subtitle="Everything officials and admins have done, newest first."
      />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <div ref={resourceRef} className="relative">
          <button
            type="button"
            aria-label="Filter by module"
            aria-haspopup="menu"
            aria-expanded={resourceOpen}
            onClick={() => {
              setResourceOpen((open) => !open)
              setActionOpen(false)
            }}
            className="flex h-10 w-40 items-center whitespace-nowrap rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <span className="flex-1 text-center">
              {RESOURCES.find((option) => option.value === resource)?.label}
            </span>
            <Icon name={resourceOpen ? 'expand_less' : 'expand_more'} className="text-[18px]" />
          </button>
          {resourceOpen && (
            <div
              role="menu"
              aria-label="Filter by module"
              className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float"
            >
              {RESOURCES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={resource === option.value}
                  onClick={() => {
                    setResource(option.value)
                    setResourceOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-low ${
                    resource === option.value ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {option.label}
                  {resource === option.value && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="sr-only" htmlFor="activity-user-filter">Filter by user</label>
        <select
          id="activity-user-filter"
          aria-label="Filter by user"
          value={userId}
          disabled={usersLoading}
          onChange={(event) => setUserId(event.target.value)}
          className="h-10 min-w-44 rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container disabled:cursor-wait disabled:opacity-60"
        >
          <option value="">{usersLoading ? 'Loading users…' : 'All users'}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.display_name}{user.email ? ` · ${user.email}` : ''}
            </option>
          ))}
        </select>

        <div ref={actionRef} className="relative">
          <button
            type="button"
            aria-label="Filter by action"
            aria-haspopup="menu"
            aria-expanded={actionOpen}
            onClick={() => {
              setActionOpen((open) => !open)
              setResourceOpen(false)
            }}
            className="flex h-10 w-56 items-center whitespace-nowrap rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <span className="flex-1 text-center">
              {ACTIONS.find((option) => option.value === action)?.label}
            </span>
            <Icon name={actionOpen ? 'expand_less' : 'expand_more'} className="text-[18px]" />
          </button>
          {actionOpen && (
            <div
              role="menu"
              aria-label="Filter by action"
              className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float"
            >
              {ACTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={action === option.value}
                  onClick={() => {
                    setAction(option.value)
                    setActionOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-low ${
                    action === option.value ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {option.label}
                  {action === option.value && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {(resource || action || userId) && (
          <button
            type="button"
            onClick={() => {
              setResource('')
              setAction('')
              setUserId('')
              setResourceOpen(false)
              setActionOpen(false)
            }}
            className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="flex justify-end"><button type="button" onClick={reload} className="rounded-md px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-low">Retry loading activity</button></div>}

      <div className="rounded-xl border border-outline bg-surface-lowest">
        {loading ? (
          <p className="px-5 py-16 text-center text-sm text-muted">Loading activity...</p>
        ) : entries.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-muted">
            {resource || action || userId
              ? 'Nothing matches those filters.'
              : 'No activity recorded yet.'}
          </p>
        ) : (
          <ActivityFeed entries={entries} />
        )}
      </div>

      {(offset > 0 || hasNext) && (
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="flex items-center gap-1 rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="chevron_left" className="text-[18px]" />
            Newer
          </button>

          <p className="text-sm text-muted">
            {showingFrom}-{showingTo} of {total}
          </p>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="flex items-center gap-1 rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {/*
              "Older", not "Next". The feed runs newest first, so moving
              forward through pages moves backwards through time, and a pager
              labelled Next/Previous makes the reader work out which is which.
            */}
            Older
            <Icon name="chevron_right" className="text-[18px]" />
          </button>
        </div>
      )}
    </div>
  )
}
