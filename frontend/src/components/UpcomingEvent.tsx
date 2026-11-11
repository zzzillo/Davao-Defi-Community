import { Link } from 'react-router-dom'
import Icon from './Icon'
import { useEvents } from '../hooks/useEvents'
import { useToastError } from '../hooks/useToast'
import { formatEventDay, formatEventTimeRange, stripHtml } from '../utils/event'

const DESCRIPTION_PREVIEW_LENGTH = 300

function preview(description: string | null): string {
  const text = stripHtml(description)
  if (text.length <= DESCRIPTION_PREVIEW_LENGTH) return text
  return `${text.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd()}...`
}

export default function UpcomingEvent() {
  const upcoming = useEvents({ upcoming: true, limit: 1 })
  const latest = useEvents(
    { upcoming: false, limit: 1 },
    { enabled: !upcoming.loading && !upcoming.error && upcoming.events.length === 0 },
  )
  const event = upcoming.events[0] ?? latest.events[0]
  const showingLatest = !upcoming.events[0] && Boolean(latest.events[0])
  const loading = upcoming.loading || (!upcoming.events[0] && latest.loading)
  const error = upcoming.error ?? latest.error
  const reload = upcoming.error ? upcoming.reload : latest.reload
  useToastError(error)

  return (
    <section aria-label={showingLatest ? 'Latest event' : 'Upcoming event'} className="w-full">
      <div className="w-full">
        <h2 data-scroll-reveal className="scroll-reveal mb-4 text-xl font-semibold tracking-tight text-black dark:text-[#f5f5f5] sm:text-2xl">
          {showingLatest ? 'Latest event' : 'Upcoming event'}
        </h2>

        {error && <div className="mb-4 text-right"><button type="button" onClick={reload} className="text-sm font-semibold underline underline-offset-2">Retry loading events</button></div>}

        {loading && !event ? (
          <p role="status" className="py-10 text-center text-sm text-gray-500 dark:text-[#8a8a8a]">Loading event...</p>
        ) : !event ? (
          error ? null : <p className="py-10 text-center text-sm text-gray-500 dark:text-[#8a8a8a]">No upcoming or recent events yet.</p>
        ) : (
          <Link
            to={`/events/${event.id}`}
            data-scroll-reveal
            className="scroll-reveal group grid w-full grid-cols-1 items-start gap-5 overflow-hidden text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58C2F] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-8"
          >
            <div className="relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden bg-[#f3e7dc] dark:bg-[#141414]">
              {event.banner_image_url ? (
                <img
                  src={event.banner_image_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(imageEvent) => { imageEvent.currentTarget.hidden = true }}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500 dark:text-[#777]">
                  <Icon name="event" className="text-[44px]" />
                </div>
              )}
            </div>

            <div className="flex flex-col items-start justify-start gap-4 text-left sm:self-center">
              <h3 className="max-w-[680px] text-2xl font-semibold leading-tight tracking-tight text-black dark:text-[#f5f5f5] sm:text-3xl lg:text-4xl">
                {event.title}
              </h3>
              {event.description && (
                <p className="max-w-[680px] text-sm leading-relaxed text-gray-600 dark:text-[#b5b5b5] sm:text-base">
                  {preview(event.description)}
                </p>
              )}
              <div className="flex flex-col gap-4">
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]">When</span>
                  <span className="mt-0.5 block text-sm font-medium text-gray-700 dark:text-[#b5b5b5] sm:text-base">
                    {formatEventDay(event.start_datetime)} · {formatEventTimeRange(event)}
                  </span>
                </div>
                {event.location && (
                  <div>
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]">Where</span>
                    <span className="mt-0.5 block text-sm font-medium text-gray-700 dark:text-[#b5b5b5] sm:text-base">{event.location}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        )}
      </div>
    </section>
  )
}
