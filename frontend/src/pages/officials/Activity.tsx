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
  const [userQuery, setUserQuery] = useState('')
  const [users, setUsers] = useState<AppUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [resourceOpen, setResourceOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const resourceRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const mobileUserRef = useRef<HTMLDivElement>(null)
  const mobileFilterRef = useRef<HTMLDivElement>(null)

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
      if (userRef.current && !userRef.current.contains(target)) setUserOpen(false)
      if (mobileUserRef.current && !mobileUserRef.current.contains(target)) setUserOpen(false)
      if (mobileFilterRef.current && !mobileFilterRef.current.contains(target)) setMobileFilterOpen(false)
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
  const matchingUsers = users.filter((user) => {
    const query = userQuery.trim().toLocaleLowerCase()
    return !query || user.display_name.toLocaleLowerCase().includes(query) || user.email?.toLocaleLowerCase().includes(query)
  })

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Activity"
        subtitle="Everything officials and admins have done, newest first."
      />

      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex items-center justify-end gap-2 sm:hidden">
          {mobileSearchOpen ? (
            <div ref={mobileUserRef} className="relative min-w-0 flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted" />
              <label className="sr-only" htmlFor="activity-user-filter-mobile">Search users</label>
              <input
                id="activity-user-filter-mobile"
                type="search"
                role="combobox"
                aria-label="Search users"
                aria-autocomplete="list"
                aria-expanded={userOpen}
                aria-controls="activity-user-options-mobile"
                value={userQuery}
                disabled={usersLoading}
                onFocus={() => setUserOpen(true)}
                onChange={(event) => {
                  setUserQuery(event.target.value)
                  setUserId('')
                  setUserOpen(true)
                }}
                placeholder={usersLoading ? 'Loading users…' : 'Search users'}
                className="h-10 w-full rounded-lg border border-outline bg-surface-lowest py-2 pl-10 pr-10 text-sm text-on-surface placeholder:text-muted focus:outline-none disabled:cursor-wait disabled:opacity-60"
              />
              <button
                type="button"
                aria-label="Close user search"
                onClick={() => {
                  setMobileSearchOpen(false)
                  setUserOpen(false)
                }}
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-low"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
              {userOpen && !usersLoading && (
                <div
                  id="activity-user-options-mobile"
                  role="listbox"
                  aria-label="Users"
                  className="absolute right-0 top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-outline bg-surface-lowest p-1 shadow-float"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={!userId}
                    onClick={() => {
                      setUserId('')
                      setUserQuery('')
                      setUserOpen(false)
                    }}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low"
                  >
                    All users
                    {!userId && <Icon name="check" className="text-[16px]" />}
                  </button>
                  {matchingUsers.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted">No users found.</p>
                  ) : matchingUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      role="option"
                      aria-selected={userId === user.id}
                      onClick={() => {
                        setUserId(user.id)
                        setUserQuery(user.display_name)
                        setUserOpen(false)
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-on-surface">{user.display_name}</span>
                        {user.email && <span className="block truncate text-xs text-muted">{user.email}</span>}
                      </span>
                      {userId === user.id && <Icon name="check" className="shrink-0 text-[16px]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              aria-label="Search users"
              onClick={() => setMobileSearchOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-low"
            >
              <Icon name="search" className="text-[22px]" />
            </button>
          )}

          <div ref={mobileFilterRef} className="relative shrink-0">
            <button
              type="button"
              aria-label="Filter activity"
              aria-haspopup="menu"
              aria-expanded={mobileFilterOpen}
              onClick={() => {
                setMobileFilterOpen((open) => !open)
                setUserOpen(false)
              }}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-low"
            >
              <Icon name={mobileFilterOpen ? 'expand_less' : 'filter_list'} className="text-[22px]" />
            </button>
            {mobileFilterOpen && (
              <div
                role="menu"
                aria-label="Activity filters"
                className="absolute right-0 top-full z-30 mt-1 max-h-[min(70vh,32rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-outline bg-surface-lowest p-2 shadow-float"
              >
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Everything</p>
                {RESOURCES.map((option) => (
                  <button
                    key={`mobile-resource-${option.value}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={resource === option.value}
                    onClick={() => setResource(option.value)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-surface-low ${resource === option.value ? 'text-on-surface' : 'text-on-surface-variant'}`}
                  >
                    {option.label}
                    {resource === option.value && <Icon name="check" className="text-[16px]" />}
                  </button>
                ))}
                <div className="my-2 border-t border-outline" />
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Any action</p>
                {ACTIONS.map((option) => (
                  <button
                    key={`mobile-action-${option.value}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={action === option.value}
                    onClick={() => setAction(option.value)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-surface-low ${action === option.value ? 'text-on-surface' : 'text-on-surface-variant'}`}
                  >
                    {option.label}
                    {action === option.value && <Icon name="check" className="text-[16px]" />}
                  </button>
                ))}
                {(resource || action || userId) && (
                  <>
                    <div className="my-2 border-t border-outline" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setResource('')
                        setAction('')
                        setUserId('')
                        setUserQuery('')
                        setUserOpen(false)
                        setMobileFilterOpen(false)
                      }}
                      className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-low"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div ref={userRef} className="relative hidden w-full order-1 sm:block sm:w-64">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted" />
          <label className="sr-only" htmlFor="activity-user-filter">Search users</label>
          <input
            id="activity-user-filter"
            type="search"
            role="combobox"
            aria-label="Search users"
            aria-autocomplete="list"
            aria-expanded={userOpen}
            aria-controls="activity-user-options"
            value={userQuery}
            disabled={usersLoading}
            onFocus={() => setUserOpen(true)}
            onChange={(event) => {
              setUserQuery(event.target.value)
              setUserId('')
              setUserOpen(true)
            }}
            placeholder={usersLoading ? 'Loading users…' : 'Search users'}
            className="h-10 w-full rounded-lg bg-surface-low py-2 pl-10 pr-10 text-sm font-medium text-on-surface placeholder:text-on-surface focus:outline-none disabled:cursor-wait disabled:opacity-60"
          />
          {(userQuery || userId) && (
            <button
              type="button"
              aria-label="Clear user filter"
              onClick={() => {
                setUserQuery('')
                setUserId('')
                setUserOpen(false)
              }}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          )}
          {userOpen && !usersLoading && (
            <div
              id="activity-user-options"
              role="listbox"
              aria-label="Users"
              className="absolute right-0 top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-outline bg-surface-lowest p-1 shadow-float"
            >
              <button
                type="button"
                role="option"
                aria-selected={!userId}
                onClick={() => {
                  setUserId('')
                  setUserQuery('')
                  setUserOpen(false)
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low"
              >
                All users
                {!userId && <Icon name="check" className="text-[16px]" />}
              </button>
              {matchingUsers.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">No users found.</p>
              ) : matchingUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  role="option"
                  aria-selected={userId === user.id}
                  onClick={() => {
                    setUserId(user.id)
                    setUserQuery(user.display_name)
                    setUserOpen(false)
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-on-surface">{user.display_name}</span>
                    {user.email && <span className="block truncate text-xs text-muted">{user.email}</span>}
                  </span>
                  {userId === user.id && <Icon name="check" className="shrink-0 text-[16px]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div ref={resourceRef} className="relative hidden order-3 w-full sm:block sm:w-auto">
          <button
            type="button"
            aria-label="Filter by module"
            aria-haspopup="menu"
            aria-expanded={resourceOpen}
            onClick={() => {
              setResourceOpen((open) => !open)
              setActionOpen(false)
            }}
            className="flex h-10 w-full items-center whitespace-nowrap rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container sm:w-40"
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
              className="absolute right-0 top-full z-20 mt-1 w-40 max-w-[calc(100vw-2rem)] rounded-lg border border-outline bg-surface-lowest p-1 shadow-float"
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

        <div ref={actionRef} className="relative hidden order-2 w-full sm:block sm:w-auto">
          <button
            type="button"
            aria-label="Filter by action"
            aria-haspopup="menu"
            aria-expanded={actionOpen}
            onClick={() => {
              setActionOpen((open) => !open)
              setResourceOpen(false)
            }}
            className="flex h-10 w-full items-center whitespace-nowrap rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container sm:w-56"
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
              className="absolute right-0 top-full z-20 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-outline bg-surface-lowest p-1 shadow-float"
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
              setUserQuery('')
              setResourceOpen(false)
              setActionOpen(false)
              setUserOpen(false)
            }}
            className="hidden text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface sm:block"
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
