import { Link, useParams } from 'react-router-dom'

import Icon from '../../components/Icon'
import { useBlogBySlug } from '../../hooks/useBlogs'
import { formatPublishedDate, readingTime } from '../../utils/blog'

/**
 * One article, in full - the shareable address for a piece of writing.
 *
 * Resolved by slug rather than by UUID, unlike every other detail page in this
 * app. That is the whole point of blogs having a slug: /blog/understanding-web3
 * is an address a person can read, remember, and put in a message, and it is
 * frozen once the article is published so it keeps working.
 *
 * The officials' editor still addresses articles by id, because a draft's slug
 * can change and an edit URL that moves mid-edit is broken.
 */
export default function BlogDetails() {
  const { slug } = useParams()
  const { blog, loading, error } = useBlogBySlug(slug)

  if (loading) {
    return <p className="py-24 text-center text-sm text-muted">Loading article...</p>
  }

  // The API answers 404 for an unpublished article as well as a missing one,
  // on purpose: a distinct 403 would confirm that a draft with this address
  // exists, which is a detail the public has no business learning from a URL.
  if (error || !blog) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Icon name="article" className="text-[40px] text-muted" />
        <p className="text-lg font-semibold text-on-surface">Article not found</p>
        <p className="max-w-md text-sm text-on-surface-variant">
          {error && error.status !== 404
            ? error.message
            : 'This article may have been removed, or it is not published yet.'}
        </p>
        <Link
          to="/blogs"
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Browse articles
        </Link>
      </div>
    )
  }

  return (
    // Narrower than the layout's own max width. A column of prose stops being
    // readable somewhere around seventy-five characters, and the public list
    // beside it is deliberately wider - a grid of cards wants the room, a
    // paragraph does not.
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        to="/blogs"
        className="flex w-fit items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Icon name="arrow_back" className="text-[20px]" />
        Back to Blog
      </Link>

      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-on-surface sm:text-4xl">
          {blog.title}
        </h1>

        {blog.excerpt && (
          <p className="text-lg leading-relaxed text-on-surface-variant">
            {/* Plain text by construction - the backend strips every tag. */}
            {blog.excerpt}
          </p>
        )}

        <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-on-surface-variant">
          {blog.creator && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Written by</dt>
              <Icon name="person" className="text-[18px]" />
              <dd>{blog.creator.display_name}</dd>
            </div>
          )}

          {blog.published_at && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Published</dt>
              <Icon name="calendar_today" className="text-[18px]" />
              {/*
                published_at, not created_at or updated_at. This article may
                have been drafted weeks before it went out and typo-fixed after;
                the date under a headline is the one it became public.
              */}
              <dd>{formatPublishedDate(blog.published_at)}</dd>
            </div>
          )}

          <div className="flex items-center gap-2">
            <dt className="sr-only">Length</dt>
            <Icon name="schedule" className="text-[18px]" />
            <dd>{readingTime(blog.content)}</dd>
          </div>
        </dl>
      </header>

      {blog.cover_image_url && (
        <img
          src={blog.cover_image_url}
          alt=""
          className="w-full rounded-xl object-cover"
        />
      )}

      {blog.content ? (
        /*
          Rendered as HTML, which is what an article is.

          Safe because the backend sanitises on write, not because this page
          checks anything: app/services/html_service.py runs an allowlist over
          every article before it is stored, so what arrives here has no event
          handler, no script, and no javascript: URL left in it. Every reader -
          this page, a future RSS feed, an email digest - inherits that without
          having to remember.

          editor-block rich-text pairs with the editor's own styling in
          index.css, so a published article looks like it did while it was
          being written rather than approximately like it.
        */
        <div
          className="editor-block rich-text text-base leading-relaxed text-on-surface"
          dangerouslySetInnerHTML={{ __html: blog.content }}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-outline px-4 py-8 text-center text-sm text-muted">
          This article has no content yet.
        </p>
      )}
    </article>
  )
}
