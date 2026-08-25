import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import EventStatusBadge from '../../components/events/EventStatusBadge'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useEventActions, useEvents } from '../../hooks/useEvents'
import { usePosts } from '../../hooks/usePosts'
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
    'Upcoming' | 'Lacks Recap' | 'Past' | 'Drafts' | 'All'
  >('Upcoming')
  const [postOpen, setPostOpen] = useState(false)
  // Event ids are UUID strings now, not the numbers the mock data used.
  const [menuId, setMenuId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  // Every recap, so the badges below are a lookup rather than one request per
  // event. include_drafts needs posts.read; an official without it gets an
  // error here instead of a list, which is why recapsUnavailable exists rather
  // than an assumption that an empty result means "no recaps exist".
  const { posts: recaps, error: recapError, reload: reloadRecaps } = usePosts({
    include_drafts: true,
    limit: 100,
  })

  const recapsUnavailable = recapError !== null

  // An event has at most one recap - the database enforces it - so this is a
  // map, not a count. That is the whole shape change from the mock version,
  // where a post carried an eventId and an event could accumulate several.
  const recapByEventId = new Map(
    recaps.filter((post) => post.event).map((post) => [post.event!.id, post]),
  )

  // A recap only makes sense once an event has started; an upcoming one has
  // nothing to recap yet.
  const canHaveRecap = (event: EventResponse) => {
    const status = deriveEventStatus(event)
    return status === 'Ongoing' || status === 'Completed'
  }

  // Suppressed when the recap list could not be loaded: a red badge claiming
  // work is missing, shown because a request failed, is worse than no badge.
  const lacksRecap = (event: EventResponse) =>
    !recapsUnavailable && canHaveRecap(event) && !recapByEventId.has(event.id)

  // Searching already happened on the server. What is left is the status
  // filter, which has to run here because status is derived, not stored.
  const filtered = items.filter((event) => {
    const status = deriveEventStatus(event)
    if (postFilter === 'Upcoming' && status !== 'Upcoming' && status !== 'Ongoing') return false
    if (postFilter === 'Past' && status !== 'Completed') return false
    if (postFilter === 'Drafts' && status !== 'Draft') return false
    if (postFilter === 'Lacks Recap' && !lacksRecap(event)) return false
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
        onAction={() => navigate('/admin/events/new')}
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
              {(['Upcoming', 'Lacks Recap', 'Past', 'Drafts', 'All'] as const).map((label) => (
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
                        {lacksRecap(event) && (
                          <span className="inline-flex items-center rounded-full bg-error/15 px-3 py-1 text-xs font-semibold text-error">
                            Lacks Recap
                          </span>
                        )}
                        {recapByEventId.has(event.id) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                            <Icon name="photo_library" className="text-[14px]" />
                            Recap
                            {!recapByEventId.get(event.id)!.published && ' (draft)'}
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
                              {/*
                                One item, not two. An event has at most one
                                recap, so "write one" and "open the existing
                                one" are the same slot in two states - and
                                there is no longer any such thing as linking an
                                unrelated post to an event, because the link
                                lives on the post.
                              */}
                              {canHaveRecap(event) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuId(null)
                                    const recap = recapByEventId.get(event.id)
                                    navigate(
                                      recap
                                        ? `/admin/posts/edit/${recap.id}`
                                        : `/admin/posts/new?event=${event.id}`,
                                    )
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                                >
                                  <Icon
                                    name={
                                      recapByEventId.has(event.id) ? 'photo_library' : 'add_a_photo'
                                    }
                                    className="text-[16px]"
                                  />
                                  {recapByEventId.has(event.id) ? 'Open Recap' : 'Write Recap'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuId(null)
                                  navigate(`/admin/events/edit/${event.id}`)
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
            // The recaps too. Deleting an event sets its recap's event_id to
            // NULL rather than deleting the post, so a stale map would keep
            // showing a Recap badge for an event that no longer exists.
            reloadRecaps()
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
