import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import EventRecapsCallout from '../../components/EventRecapsCallout'
import PaginationControls from '../../components/PaginationControls'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useEvents } from '../../hooks/useEvents'
import { usePosts } from '../../hooks/usePosts'
import type { EventResponse } from '../../types/event'
import type { PostResponse } from '../../types/post'
import { formatEventDay, formatEventTimeRange, stripHtml } from '../../utils/event'
import { postDisplayTitle } from '../../utils/post'

/**
 * What the community sees.
 *
 * No token, no permission, no include_drafts: GET /events serves published
 * events to anonymous callers, so this page works signed out. An official
 * visiting it sees exactly what a visitor sees, which is the point of giving
 * the public site its own URLs instead of branching one page on a role.
 */

type Tab = 'upcoming' | 'past'
const PAGE_SIZE = 12

const DESCRIPTION_PREVIEW_LENGTH = 160

function preview(description: string | null): string {
  const text = stripHtml(description)

  if (text.length <= DESCRIPTION_PREVIEW_LENGTH) return text

  return `${text.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd()}...`
}

function EventCard({ event, recap }: { event: EventResponse; recap?: PostResponse }) {
  return (
    <div className="public-image-hover relative h-full">
      <Link
        to={`/events/${event.id}`}
        aria-label={`View event: ${event.title}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline-strong"
      />
      <Card hover className={`pointer-events-none relative z-10 flex h-full flex-col overflow-hidden ${recap ? 'pb-12' : ''}`}>
        <div className="public-image-frame flex aspect-square items-center justify-center overflow-hidden bg-surface-container text-muted">
          {event.banner_image_url ? (
            // Decorative: the title sits directly beneath it, so alt text here
            // would only repeat what a screen reader is about to read out.
            <img
              src={event.banner_image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon name="calendar_month" className="text-[40px]" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">{formatEventDay(event.start_datetime)}</span>
          </div>

          <h2 className="text-lg font-semibold leading-snug text-on-surface">{event.title}</h2>

          <p className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Icon name="schedule" className="text-[18px]" />
            {formatEventTimeRange(event)}
          </p>

          {event.location && (
            <p className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Icon name="location_on" className="text-[18px]" />
              {event.location}
            </p>
          )}

          {event.description && (
            <p className="line-clamp-2 text-sm text-muted">{preview(event.description)}</p>
          )}
        </div>
      </Card>
      {recap && (
        <Link
          to={`/recaps/${recap.id}`}
          aria-label={`View recap: ${postDisplayTitle(recap)}`}
          className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1 rounded-md bg-surface-low px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline-strong"
        >
          <Icon name="photo_library" className="text-[16px]" />
          View recap
        </Link>
      )}
    </div>
  )
}

export default function PublicEvents() {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  // Searching happens on the server, so wait for a pause rather than firing a
  // request per keystroke.
  const search = useDebouncedValue(query.trim(), 300)

  // `upcoming` also decides the sort: the API returns future events soonest
  // first and past events most recent first, which is what a reader wants in
  // each case.
  const { events, total, loading, error } = useEvents({
    upcoming: tab === 'upcoming',
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
  const { posts: recaps } = usePosts({ limit: PAGE_SIZE })
  const recapsByEventId = new Map(
    recaps
      .filter((recap) => recap.event?.id)
      .map((recap) => [recap.event!.id, recap]),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Events</h1>
        <p className="text-on-surface-variant">
          Meetups, workshops and conferences from the Davao DeFi Community.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit self-start gap-1 rounded-lg bg-surface-low p-1">
          {(['upcoming', 'past'] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value)
                setPage(1)
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === value
                  ? 'bg-surface-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <label className="relative flex items-center sm:w-72">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 text-[20px] text-muted"
          />
          <span className="sr-only">Search events</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search events"
            className="w-full rounded-lg border border-outline bg-surface-lowest py-2 pl-10 pr-3 text-sm text-on-surface placeholder:text-muted focus:outline-none"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
          {error.message}
        </p>
      )}

      {loading && events.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Loading events...</p>
      ) : events.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {search
            ? `No events match "${search}".`
            : tab === 'upcoming'
              ? 'No upcoming events yet. Check back soon.'
              : 'No past events to show.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              recap={tab === 'past' ? recapsByEventId.get(event.id) : undefined}
            />
          ))}
        </div>
      )}

      <PaginationControls currentPage={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <EventRecapsCallout />
    </div>
  )
}
