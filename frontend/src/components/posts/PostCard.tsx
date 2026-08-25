import { Link } from 'react-router-dom'
import Card from '../Card'
import Icon from '../Icon'
import StatusBadge from '../StatusBadge'
import type { PostResponse } from '../../types/post'
import { coverImage, formatPostDate, imageCountLabel, postDisplayTitle } from '../../utils/post'
import { stripHtml } from '../../utils/event'

type PostCardProps = {
  post: PostResponse
  /** Where clicking the card goes. Public and admin routes differ. */
  to: string
  /** Officials need to see which posts are still drafts. The public does not. */
  showStatus?: boolean
}

const CAPTION_PREVIEW_LENGTH = 120

/**
 * One post in a list.
 *
 * Image-first: the cover fills the top of the card, and everything else is
 * secondary. That is the whole difference between this module and a blog.
 *
 * `to` is a prop rather than built here, because the same card appears in the
 * public gallery and in the officials' table, pointing at different routes.
 * A component that decided its own destination could only ever serve one.
 */
export default function PostCard({ post, to, showStatus = false }: PostCardProps) {
  const cover = coverImage(post)
  const caption = stripHtml(post.description)

  return (
    <Link to={to} className="block">
      <Card hover className="flex h-full flex-col overflow-hidden">
        <div className="relative flex aspect-[4/3] items-center justify-center bg-surface-container text-muted">
          {cover?.image_url ? (
            // Decorative: the title sits directly beneath it, so alt text here
            // would only repeat what a screen reader is about to read out.
            <img
              src={cover.image_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon name="photo_library" className="text-[40px]" />
          )}

          {post.images.length > 1 && (
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
              <Icon name="collections" className="text-[14px]" />
              {post.images.length}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            {showStatus && <StatusBadge status={post.published ? 'Posted' : 'Draft'} />}
            <span className="text-sm text-muted">{formatPostDate(post.post_date)}</span>
          </div>

          <h2 className="text-lg font-semibold leading-snug text-on-surface">
            {postDisplayTitle(post)}
          </h2>

          {post.event && (
            // Says the post recaps an event without linking anywhere: the whole
            // card is already a link, and a link inside a link is invalid HTML
            // that browsers resolve unpredictably.
            <p className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Icon name="calendar_month" className="text-[18px]" />
              <span className="truncate">{post.event.title}</span>
            </p>
          )}

          {post.location && (
            <p className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Icon name="location_on" className="text-[18px]" />
              <span className="truncate">{post.location}</span>
            </p>
          )}

          {caption && (
            <p className="text-sm text-muted">
              {/* Captions are stored as sanitised HTML. This is a preview, so
                  it wants the words only - and never innerHTML, which would
                  render markup in the middle of a card. */}
              {caption.length > CAPTION_PREVIEW_LENGTH
                ? `${caption.slice(0, CAPTION_PREVIEW_LENGTH).trimEnd()}...`
                : caption}
            </p>
          )}

          <p className="mt-auto pt-2 text-xs text-muted">
            {imageCountLabel(post.images.length)}
            {post.creator && ` · ${post.creator.display_name}`}
          </p>
        </div>
      </Card>
    </Link>
  )
}
