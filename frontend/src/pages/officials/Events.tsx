import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import EventStatusBadge from '../../components/events/EventStatusBadge'
import { posts as initialPosts } from '../../data/mock'
import type { PostItem } from '../../data/mock'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useEventActions, useEvents } from '../../hooks/useEvents'
import type { EventResponse } from '../../types/event'
import {
  deriveEventStatus,
  formatEventDay,
  formatEventTimeRange,
  stripHtml,
} from '../../utils/event'

function groupByDate(items: EventResponse[]): [string, EventResponse[]][] {
  const map = new Map<string, EventResponse[]>()
  for (const item of items) {
    // The API stores an instant. Which calendar day that falls on depends on
    // who is reading, so the heading is computed here rather than stored.
    const day = formatEventDay(item.start_datetime)
    const group = map.get(day)
    if (group) {
      group.push(item)
    } else {
      map.set(day, [item])
    }
  }
  // Map preserves insertion order and the API already sorted by start time,
  // so the groups come out in order without a second sort.
  return Array.from(map.entries())
}

export default function Events() {
  const navigate = useNavigate()
  const [postFilter, setPostFilter] = useState<
    'Upcoming' | 'Lacks Post' | 'Past' | 'Drafts' | 'All'
  >('Upcoming')
  const [postOpen, setPostOpen] = useState(false)
  // Event ids are UUID strings now, not the numbers the mock data used.
  const [menuId, setMenuId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [postList, setPostList] = useState<PostItem[]>(initialPosts)
  const [linkEventId, setLinkEventId] = useState<string | null>(null)
  const [linkQuery, setLinkQuery] = useState('')

  // Search runs on the server, so wait for a pause in typing instead of firing
  // a request per keystroke.
  const search = useDebouncedValue(query.trim(), 300)

  // include_drafts needs the events.read permission. An official without it
  // simply sees published events here, which is the correct outcome rather
  // than an error.
  const { events: items, loading, error, reload } = useEvents({
    include_drafts: true,
    search: search || undefined,
    // Status is derived from timestamps, so there is no column for the server
    // to filter on and that filtering happens below, over what this page holds.
    // Fine at community scale. Past a few hundred events, add a `published`
    // query parameter to GET /events and move the Drafts filter server-side.
    limit: 100,
  })

  const { remove, saving } = useEventActions()

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.isConnected) return
      if (!target.closest('[data-kebab]')) setMenuId(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Posts are not a backend module yet, so no post links to a real event id.
  // Without this guard postCount is always 0 and every past event would carry
  // a red "Lacks Post" badge. Flipping this to true is the whole restoration.
  const POSTS_HAVE_BACKEND = false

  const postCount = (event: EventResponse) =>
    POSTS_HAVE_BACKEND
      ? postList.filter((post) => post.eventId === event.id).length
      : 0

  const linkablePosts = postList
    .filter((post) =>
      post.description.toLowerCase().includes(linkQuery.trim().toLowerCase()),
    )
    .sort((a, b) => {
      const aLinked = a.eventId !== null ? 1 : 0
      const bLinked = b.eventId !== null ? 1 : 0
      if (aLinked !== bLinked) return aLinked - bLinked
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

  // posts only make sense for events that have started; upcoming ones can't have any
  const canHavePosts = (event: EventResponse) => {
    const status = deriveEventStatus(event)
    return status === 'Ongoing' || status === 'Completed'
  }

  const lacksPost = (event: EventResponse) =>
    POSTS_HAVE_BACKEND && canHavePosts(event) && postCount(event) === 0

  // Searching already happened on the server. What is left is the status
  // filter, which has to run here because status is derived, not stored.
  const filtered = items.filter((event) => {
    const status = deriveEventStatus(event)
    if (postFilter === 'Upcoming' && status !== 'Upcoming' && status !== 'Ongoing') return false
    if (postFilter === 'Past' && status !== 'Completed') return false
    if (postFilter === 'Drafts' && status !== 'Draft') return false
    if (postFilter === 'Lacks Post' && !lacksPost(event)) return false
    return true
  })
  // The server sorts newest first, which suits a management list and the Past
  // tab. Upcoming reads better soonest-first. Re-sorting a page already in
  // hand beats a second request, and comparing timestamps rather than the ISO
  // strings keeps it correct even if the API ever stops normalising to UTC.
  const ordered =
    postFilter === 'Upcoming'
      ? [...filtered].sort(
          (a, b) =>
            new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime(),
        )
      : filtered

  const groups = groupByDate(ordered)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Manage Events"
        subtitle="View, edit, and organize upcoming events."
        actionLabel="Add Event"
        onAction={() => navigate('/events/new')}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events, locations..."
            className="h-10 w-full rounded-lg border border-outline bg-surface-lowest pl-10 pr-4 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPostOpen((open) => !open)}
            className="flex h-10 w-36 items-center whitespace-nowrap rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <span className="flex-1 text-center">{postFilter}</span>
            <Icon name={postOpen ? 'expand_less' : 'expand_more'} className="text-[18px]" />
          </button>
          {postOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
              {(['Upcoming', 'Lacks Post', 'Past', 'Drafts', 'All'] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setPostFilter(label)
                    setPostOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-low ${
                    postFilter === label ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {label}
                  {postFilter === label && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
          {error.message}
        </p>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-muted">Loading events...</p>
      ) : groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No events found.</p>
      ) : (
        <div className="flex flex-col">
          {groups.map(([date, groupEvents]) => (
            <div
              key={date}
              className="relative grid grid-cols-[140px_1fr] gap-x-10 pb-8 last:pb-0"
            >
              <div
                aria-hidden="true"
                className="absolute bottom-0 left-[140px] top-0 border-l border-dashed border-outline"
              />
              <span
                aria-hidden="true"
                className="absolute left-[140px] top-2.5 h-2 w-2 -translate-x-1/2 rounded-full bg-outline-strong"
              />

              <div className="pt-1">
                <p className="text-base font-semibold text-on-surface">{date}</p>
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                {groupEvents.map((event) => (
                  <Card key={event.id} hover className="group relative flex items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-5">
                      <p className="text-sm text-muted">{formatEventTimeRange(event)}</p>
                      <h2 className="text-lg font-semibold leading-snug text-on-surface">
                        {event.title}
                      </h2>
                      <p className="truncate text-sm text-on-surface-variant">
                        {/* Descriptions are stored as rich HTML. This is a
                            one-line preview, so it wants the words only - and
                            never innerHTML, which would execute whatever the
                            markup contains. */}
                        {stripHtml(event.description)}
                      </p>
                      {event.location && (
                        <p className="flex items-center gap-2 text-sm text-on-surface-variant">
                          <Icon name="location_on" className="text-[18px]" />
                          {event.location}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <EventStatusBadge event={event} />
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            event.published
                              ? 'bg-success-bg text-success'
                              : 'bg-surface-low text-on-surface-variant'
                          }`}
                        >
                          {event.published ? 'Live' : 'Draft'}
                        </span>
                        {lacksPost(event) && (
                          <span className="inline-flex items-center rounded-full bg-error/15 px-3 py-1 text-xs font-semibold text-error">
                            Lacks Post
                          </span>
                        )}
                        {canHavePosts(event) && postCount(event) > 0 && (
                          <span className="inline-flex items-center rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                            {postCount(event)} Post{postCount(event) === 1 ? '' : 's'}
                          </span>
                        )}
                        <div data-kebab
                          className={`relative transition-opacity group-hover:opacity-100 ${
                            menuId === event.id ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <button
                            type="button"
                            aria-label={`Options for ${event.title}`}
                            onClick={() => setMenuId(menuId === event.id ? null : event.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                          >
                            <Icon name="more_horiz" className="text-[20px]" />
                          </button>
                          {menuId === event.id && (
                            <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
                              {canHavePosts(event) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuId(null)
                                      navigate(`/posts/new?event=${event.id}`)
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                                  >
                                    <Icon name="add_a_photo" className="text-[16px]" />
                                    Post
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuId(null)
                                      setLinkQuery('')
                                      setLinkEventId(event.id)
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                                  >
                                    <Icon name="link" className="text-[16px]" />
                                    Link Post
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuId(null)
                                  navigate(`/events/edit/${event.id}`)
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                              >
                                <Icon name="edit" className="text-[16px]" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuId(null)
                                  setDeleteId(event.id)
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                              >
                                <Icon name="delete" className="text-[16px]" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="m-4 flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container text-muted">
                      {event.banner_image_url ? (
                        // Decorative: the title sits right beside it, so an alt
                        // text here would only repeat what a screen reader just
                        // read out.
                        <img
                          src={event.banner_image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Icon name="image" className="text-[32px]" />
                      )}
                    </div>

                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {linkEventId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-outline bg-surface-lowest shadow-float">
            <div className="flex items-center justify-between border-b border-outline px-5 py-4">
              <h2 className="text-lg font-semibold text-on-surface">Link a Post</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setLinkEventId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={linkQuery}
              onChange={(event) => setLinkQuery(event.target.value)}
              placeholder="Search posts..."
              className="w-full border-b border-outline bg-transparent px-5 py-3 text-sm text-on-surface placeholder:text-muted focus:outline-none"
            />
            <div className="flex-1 overflow-y-auto p-2">
              {linkablePosts.map((post) => {
                const linkedHere = post.eventId === linkEventId
                return (
                  <button
                    key={post.id}
                    type="button"
                    disabled={linkedHere}
                    onClick={() => {
                      setPostList((current) =>
                        current.map((item) =>
                          item.id === post.id ? { ...item, eventId: linkEventId } : item,
                        ),
                      )
                      setLinkEventId(null)
                    }}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      linkedHere ? 'cursor-default opacity-60' : 'hover:bg-surface-low'
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-muted">
                      <Icon name="photo_library" className="text-[20px]" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm font-medium text-on-surface">
                        {post.description}
                      </span>
                      <span className="text-xs text-muted">
                        {post.author} · {post.date}
                      </span>
                      <span className="flex">
                        {linkedHere ? (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">
                            <Icon name="check" className="text-[13px]" />
                            Linked to this event
                          </span>
                        ) : post.eventId !== null ? (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-semibold text-warning">
                            <Icon name="link" className="text-[13px]" />
                            <span className="truncate">
                              {items.find((item) => item.id === post.eventId)?.title ??
                                'Another event'}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-low px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
                            Unlinked
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                )
              })}
              {linkablePosts.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  No posts found.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title={saving ? 'Deleting...' : 'Delete event?'}
        message="This event will be permanently removed."
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return

          try {
            await remove(deleteId)
            // Refetch rather than splicing the row out locally: the server is
            // what decides what exists, and a failed delete must not leave the
            // list claiming otherwise.
            reload()
          } catch {
            // useEventActions already captured it - the banner above shows it.
          } finally {
            setDeleteId(null)
          }
        }}
      />
    </div>
  )
}
