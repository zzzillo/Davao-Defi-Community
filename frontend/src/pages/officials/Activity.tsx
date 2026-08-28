import { useState } from 'react'

import ActivityFeed from '../../components/activity/ActivityFeed'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { useActivityLogs } from '../../hooks/useActivityLogs'
import type { ActivityAction, ActivityResource } from '../../types/activityLog'

const PAGE_SIZE = 25

const RESOURCES: { value: ActivityResource | ''; label: string }[] = [
  { value: '', label: 'Everything' },
  { value: 'event', label: 'Events' },
  { value: 'post', label: 'Posts' },
  { value: 'blog', label: 'Blogs' },
  { value: 'partner', label: 'Partners' },
  { value: 'user', label: 'Users' },
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
  const [resource, setResource] = useState<ActivityResource | ''>('')
  const [action, setAction] = useState<ActivityAction | ''>('')
  const [offset, setOffset] = useState(0)

  const { entries, total, hasNext, loading, error } = useActivityLogs({
    // Empty means "no filter", and toQueryString drops empty strings - so the
    // dropdowns' blank option needs no special case here.
    resource: resource || undefined,
    action: action || undefined,
    limit: PAGE_SIZE,
    offset,
  })

  // Changing a filter while on page 3 would ask for results 50-75 of a set that
  // may only have four. Resetting during render keeps the two in step without
  // an effect that would fetch the wrong page first and correct itself after.
  const [filteredBy, setFilteredBy] = useState(`${resource}|${action}`)

  if (filteredBy !== `${resource}|${action}`) {
    setFilteredBy(`${resource}|${action}`)
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

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="sr-only">Filter by module</span>
          <select
            value={resource}
            onChange={(event) => setResource(event.target.value as ActivityResource | '')}
            className="rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
          >
            {RESOURCES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="sr-only">Filter by action</span>
          <select
            value={action}
            onChange={(event) => setAction(event.target.value as ActivityAction | '')}
            className="rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
          >
            {ACTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {(resource || action) && (
          <button
            type="button"
            onClick={() => {
              setResource('')
              setAction('')
            }}
            className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
          {/*
            A 403 here is worth reading rather than glossing: this page needs
            the activity_logs.read permission, and an official without it sees
            exactly this.
          */}
          {error.message}
        </p>
      )}

      <div className="rounded-xl border border-outline bg-surface-lowest">
        {loading ? (
          <p className="px-5 py-16 text-center text-sm text-muted">Loading activity...</p>
        ) : entries.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-muted">
            {resource || action
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
