import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { usePost, usePosts } from '../../hooks/usePosts'
import type { PostImage, PostResponse } from '../../types/post'
import { formatPostDate, postDisplayTitle } from '../../utils/post'

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
    return <p className="py-24 text-center text-sm text-muted">Loading recap...</p>
  }

  // The API answers 404 for an unpublished post as well as a missing one, on
  // purpose: a distinct 403 would confirm that a draft with this id exists,
  // which is a detail the public has no business learning from a URL.
  if (error || !post) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Icon name="hide_image" className="text-[40px] text-muted" />
        <p className="text-lg font-semibold text-on-surface">Recap not found</p>
        <p className="max-w-md text-sm text-on-surface-variant">
          {error && error.status !== 404
            ? error.message
            : 'This recap may have been removed, or it is not published yet.'}
        </p>
        <Link
          to="/recaps"
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Browse recaps
        </Link>
      </div>
    )
  }

  return (
    <article className="flex flex-col gap-6">
      <Link
        to="/recaps"
        className="flex w-fit items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Icon name="arrow_back" className="text-[20px]" />
        Back to recaps
      </Link>

      <PostGallery key={post.id} images={post.images} />

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
          {postDisplayTitle(post)}
        </h1>

        <dl className="flex max-w-full flex-nowrap items-center gap-x-4 overflow-x-auto text-on-surface-variant">
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <dt className="sr-only">Date</dt>
            <Icon name="calendar_today" className="text-[20px]" />
            <dd>{formatPostDate(post.post_date)}</dd>
          </div>

          {post.location && (
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <dt className="sr-only">Location</dt>
              <Icon name="location_on" className="text-[20px]" />
              <dd>{post.location}</dd>
            </div>
          )}

          {post.creator && (
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <dt className="sr-only">Posted by</dt>
              <Icon name="person" className="text-[20px]" />
              <dd>{post.creator.display_name}</dd>
            </div>
          )}

        </dl>
      </header>

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

      {post.images.length === 0 && (
        <p className="rounded-xl border border-dashed border-outline px-4 py-8 text-center text-sm text-muted">
          No photos on this recap yet.
        </p>
      )}

      <ExploreMore currentPost={post} />
    </article>
  )
}

function PostGallery({ images }: { images: PostImage[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (images.length === 0) return null

  const selectedImage = images[selectedIndex] ?? images[0]
  const selectPrevious = () => setSelectedIndex((index) => (index - 1 + images.length) % images.length)
  const selectNext = () => setSelectedIndex((index) => (index + 1) % images.length)

  return (
    <section className="mx-auto w-full max-w-3xl" aria-label="Recap photos">
      <div className="public-image-frame group relative aspect-video overflow-hidden rounded-xl bg-surface-container">
        {selectedImage.image_url ? (
          <img
            key={selectedImage.id}
            src={selectedImage.image_url}
            alt={`Recap photo ${selectedIndex + 1} of ${images.length}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <Icon name="image" className="text-[40px]" />
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={selectPrevious}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-lowest/90 text-on-surface shadow transition-opacity hover:bg-surface-lowest sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            >
              <Icon name="chevron_left" className="text-[22px]" />
            </button>
            <button
              type="button"
              onClick={selectNext}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-lowest/90 text-on-surface shadow transition-opacity hover:bg-surface-lowest sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            >
              <Icon name="chevron_right" className="text-[22px]" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white">
              {selectedIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto py-1" aria-label="Choose a photo">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Show photo ${index + 1}`}
              aria-current={index === selectedIndex ? 'true' : undefined}
              className={`public-image-hover public-image-frame relative h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 bg-surface-container transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-strong ${index === selectedIndex ? 'border-outline-strong' : 'border-transparent opacity-75 hover:border-outline hover:opacity-100'}`}
            >
              {image.image_url ? (
                <img src={image.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-muted">
                  <Icon name="image" className="text-[20px]" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function ExploreMore({ currentPost }: { currentPost: PostResponse }) {
  const { posts, loading } = usePosts({ limit: 8 })
  const otherPosts = posts.filter((post) => post.id !== currentPost.id).slice(0, 4)

  if (!loading && otherPosts.length === 0) return null

  return (
    <section className="mt-4 border-t border-outline pt-6" aria-labelledby="explore-more-heading">
      <div className="mb-4">
        <h2 id="explore-more-heading" className="text-xl font-bold text-on-surface">
          More recaps
        </h2>
      </div>

      {loading ? (
        <p className="py-6 text-sm text-muted">Loading more recaps...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {otherPosts.map((post) => (
            <CompactRecapCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </section>
  )
}

function CompactRecapCard({ post }: { post: PostResponse }) {
  const cover = post.images[0]

  return (
    <Link to={`/recaps/${post.id}`} className="public-image-hover group overflow-hidden rounded-xl border border-outline bg-surface-lowest transition-colors hover:bg-surface-low">
      <div className="public-image-frame aspect-[16/9] overflow-hidden bg-surface-container">
        {cover?.image_url ? (
          <img src={cover.image_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <Icon name="photo_library" className="text-[28px]" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-muted">{formatPostDate(post.post_date)}</p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-on-surface">
          {postDisplayTitle(post)}
        </h3>
      </div>
    </Link>
  )
}
