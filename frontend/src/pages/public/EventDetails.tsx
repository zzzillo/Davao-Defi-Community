import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useEvent } from '../../hooks/useEvents'
import { formatEventDay, formatEventTimeRange } from '../../utils/event'

/**
 * One RSVP listing, in full.
 *
 * This is the shareable address for an RSVP - /rsvp/<id>. The id is the
 * UUID rather than a slug: a slug would have to be stored, kept unique, and
 * kept working after a title is edited. When that is worth doing, add a `slug`
 * column and accept either here; nothing else on this page changes.
 */
export default function EventDetails() {
  const { id } = useParams()
  const { event, loading, error, reload } = useEvent(id)

  if (loading) {
    return <p className="py-24 text-center text-sm text-muted">Loading RSVP...</p>
  }

  // The API answers 404 for an unpublished event as well as a missing one, on
  // purpose: a distinct 403 would confirm that a draft with this id exists,
  // which is a detail the public has no business learning from a URL.
  if (error || !event) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Icon name="event_busy" className="text-[40px] text-muted" />
        <p className="text-lg font-semibold text-on-surface">
          {error && error.status !== 404 ? 'RSVP unavailable' : 'RSVP not found'}
        </p>
        <p className="max-w-md text-sm text-on-surface-variant">
          {error && error.status !== 404
            ? error.message
            : 'This RSVP may have been removed, or it is not published yet.'}
        </p>
        {error && error.status !== 404 && (
          <button type="button" onClick={reload} className="text-sm font-semibold text-primary underline underline-offset-4">
            Try again
          </button>
        )}
        <Link
          to="/"
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Back to community
        </Link>
      </div>
    )
  }

  return (
    <article className="flex flex-col gap-6">
      <Link
        to="/"
        className="flex w-fit items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Icon name="arrow_back" className="text-[20px]" />
        Back to community
      </Link>

      <div
        className={`grid items-start gap-6 sm:gap-8 ${event.banner_image_url ? 'lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]' : ''}`}
      >
        {event.banner_image_url && (
          <div className="public-image-hover public-image-frame aspect-square w-full overflow-hidden rounded-xl">
            <img
              src={event.banner_image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
              {event.title}
            </h1>

            <dl className="flex flex-col gap-2 text-on-surface-variant">
              <div className="flex items-center gap-2">
                <dt className="sr-only">Date</dt>
                <Icon name="calendar_month" className="text-[20px]" />
                <dd>
                  {formatEventDay(event.start_datetime)} &middot; {formatEventTimeRange(event)}
                </dd>
              </div>

              {event.location && (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Location</dt>
                  <Icon name="location_on" className="text-[20px]" />
                  <dd>{event.location}</dd>
                </div>
              )}

            </dl>
          </header>

          {event.description && (
            /*
              Rendered as real HTML rather than as text, because the editor exists
              to produce headings, lists and links and flattening them here would
              waste that.

              Safe because the markup was cleaned before it was stored: every write
              goes through app/services/html_service.py, which allowlists the tags
              and attributes the editor can produce and drops everything else -
              event handlers, script and style, and javascript:/data: URLs. Cleaning
              on write rather than here is what keeps every other reader of this
              column safe too.

              If that ever changes, this line becomes an XSS hole. It is the reason
              the sanitiser is not optional.
            */
            <div
              className="editor-block rich-text text-on-surface"
              dangerouslySetInnerHTML={{ __html: event.description }}
            />
          )}

          {event.registration_url && (
            <a
              href={event.registration_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 self-end rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
            >
              RSVP now
              <Icon name="open_in_new" className="text-[18px]" />
            </a>
          )}
        </div>
      </div>

    </article>
  )
}
