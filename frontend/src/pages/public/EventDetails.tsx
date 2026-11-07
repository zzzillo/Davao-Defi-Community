import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useEvent } from '../../hooks/useEvents'
import { usePosts } from '../../hooks/usePosts'
import { deriveEventStatus, formatEventDay, formatEventTimeRange } from '../../utils/event'
import { formatPostDate, postDisplayTitle } from '../../utils/post'

/**
 * One event, in full.
 *
 * This is the shareable address for an event - /events/<id>. The id is the
 * UUID rather than a slug: a slug would have to be stored, kept unique, and
 * kept working after a title is edited. When that is worth doing, add a `slug`
 * column and accept either here; nothing else on this page changes.
 */
export default function EventDetails() {
  const { id } = useParams()
  const { event, loading, error } = useEvent(id)
  const { posts: connectedRecaps, loading: recapsLoading } = usePosts({
    event_id: id,
    limit: 1,
  })

  if (loading) {
    return <p className="py-24 text-center text-sm text-muted">Loading event...</p>
  }

  // The API answers 404 for an unpublished event as well as a missing one, on
  // purpose: a distinct 403 would confirm that a draft with this id exists,
  // which is a detail the public has no business learning from a URL.
  if (error || !event) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Icon name="event_busy" className="text-[40px] text-muted" />
        <p className="text-lg font-semibold text-on-surface">Event not found</p>
        <p className="max-w-md text-sm text-on-surface-variant">
          {error && error.status !== 404
            ? error.message
            : 'This event may have been removed, or it is not published yet.'}
        </p>
        <Link
          to="/events"
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Browse events
        </Link>
      </div>
    )
  }

  return (
    <article className="flex flex-col gap-6">
      <Link
        to="/events"
        className="flex w-fit items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Icon name="arrow_back" className="text-[20px]" />
        Back to Events
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

              {event.creator && (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Posted by</dt>
                  <Icon name="person" className="text-[20px]" />
                  <dd>Posted by {event.creator.display_name}</dd>
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
              Register for this event
              <Icon name="open_in_new" className="text-[18px]" />
            </a>
          )}
        </div>
      </div>

      {event && deriveEventStatus(event) === 'Completed' && !recapsLoading && connectedRecaps[0] && (
        <section className="border-t border-outline pt-6" aria-labelledby="event-recap-heading">
          <div className="mb-4">
            <h2 id="event-recap-heading" className="mt-1 text-xl font-bold text-on-surface">
              Event recap
            </h2>
          </div>

          <Link
            to={`/recaps/${connectedRecaps[0].id}`}
            className="public-image-hover group block w-full max-w-xs overflow-hidden rounded-xl border border-outline bg-surface-lowest transition-colors hover:bg-surface-low"
          >
            <div className="public-image-frame aspect-video w-full overflow-hidden bg-surface-container">
              {connectedRecaps[0].images[0]?.image_url ? (
                <img
                  src={connectedRecaps[0].images[0].image_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">
                  <Icon name="photo_library" className="text-[28px]" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-col p-3">
              <p className="text-xs text-muted">{formatPostDate(connectedRecaps[0].post_date)}</p>
              <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-on-surface">
                {postDisplayTitle(connectedRecaps[0])}
              </h3>
            </div>
          </Link>
        </section>
      )}
    </article>
  )
}
