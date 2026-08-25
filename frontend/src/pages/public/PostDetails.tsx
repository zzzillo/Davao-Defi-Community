import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import ImageGrid from '../../components/posts/ImageGrid'
import { usePost } from '../../hooks/usePosts'
import { formatEventDay } from '../../utils/event'
import { formatPostDate, imageCountLabel, postDisplayTitle } from '../../utils/post'

/**
 * One post, in full - the shareable address for a recap.
 *
 * The id is the UUID rather than a slug: a slug would have to be stored, kept
 * unique, and kept working after a title is edited. When that is worth doing,
 * add a slug column and accept either here; nothing else on this page changes.
 */
export default function PostDetails() {
  const { id } = useParams()
  const { post, loading, error } = usePost(id)

  if (loading) {
    return <p className="py-24 text-center text-sm text-muted">Loading post...</p>
  }

  // The API answers 404 for an unpublished post as well as a missing one, on
  // purpose: a distinct 403 would confirm that a draft with this id exists,
  // which is a detail the public has no business learning from a URL.
  if (error || !post) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Icon name="hide_image" className="text-[40px] text-muted" />
        <p className="text-lg font-semibold text-on-surface">Post not found</p>
        <p className="max-w-md text-sm text-on-surface-variant">
          {error && error.status !== 404
            ? error.message
            : 'This post may have been removed, or it is not published yet.'}
        </p>
        <Link
          to="/posts"
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Browse posts
        </Link>
      </div>
    )
  }

  return (
    <article className="flex flex-col gap-6">
      <Link
        to="/posts"
        className="flex w-fit items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Icon name="arrow_back" className="text-[20px]" />
        Back to Posts
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
          {postDisplayTitle(post)}
        </h1>

        <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-on-surface-variant">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Date</dt>
            <Icon name="calendar_today" className="text-[20px]" />
            <dd>{formatPostDate(post.post_date)}</dd>
          </div>

          {post.location && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Location</dt>
              <Icon name="location_on" className="text-[20px]" />
              <dd>{post.location}</dd>
            </div>
          )}

          {post.creator && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Posted by</dt>
              <Icon name="person" className="text-[20px]" />
              <dd>{post.creator.display_name}</dd>
            </div>
          )}

          {post.images.length > 0 && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Photos</dt>
              <Icon name="photo_library" className="text-[20px]" />
              <dd>{imageCountLabel(post.images.length)}</dd>
            </div>
          )}
        </dl>
      </header>

      {/*
        The event this recaps, when there is one. A real link, unlike the same
        line on a card - here the page is not itself a link, so nesting is not
        a problem.

        Hidden when the event is still a draft: the public cannot open it, and
        offering a link to a 404 is worse than offering nothing.
      */}
      {post.event?.published && (
        <Link
          to={`/events/${post.event.id}`}
          className="flex items-center gap-3 rounded-xl border border-outline bg-surface-lowest p-4 transition-colors hover:bg-surface-low"
        >
          <Icon name="calendar_month" className="text-[24px] text-muted" />

          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Recap of
            </span>
            <span className="truncate text-sm font-semibold text-on-surface">
              {post.event.title}
            </span>
            <span className="text-xs text-muted">
              {formatEventDay(post.event.start_datetime)}
            </span>
          </span>

          <Icon name="chevron_right" className="text-[20px] text-muted" />
        </Link>
      )}

      {post.description && (
        /*
          Rendered as HTML rather than as text, even though the caption is
          typed into a plain textarea.

          The backend sanitises every caption on write, and sanitising escapes
          characters that are meaningful in markup: "5 < 10" is stored as
          "5 &lt; 10", and "Tom & Jerry" as "Tom &amp; Jerry". Printing that as
          text would show the entities literally. Rendering it as HTML decodes
          them, and whitespace-pre-wrap keeps the line breaks somebody typed.

          Safe for the same reason as an event description: see
          app/services/html_service.py.
        */
        <div
          className="whitespace-pre-wrap text-on-surface"
          dangerouslySetInnerHTML={{ __html: post.description }}
        />
      )}

      <ImageGrid images={post.images} />

      {post.images.length === 0 && (
        <p className="rounded-xl border border-dashed border-outline px-4 py-8 text-center text-sm text-muted">
          No photos on this post yet.
        </p>
      )}
    </article>
  )
}
