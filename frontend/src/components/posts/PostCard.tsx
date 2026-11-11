import { Link } from 'react-router-dom'
import Card from '../Card'
import Icon from '../Icon'
import StatusBadge from '../StatusBadge'
import type { PostResponse } from '../../types/post'
import { coverImage, formatPostDate, postDisplayTitle } from '../../utils/post'
import { stripHtml } from '../../utils/event'

type PostCardProps = {
  post: PostResponse
  /** Where clicking the card goes. Public and admin routes differ. */
  to: string
  /** Officials need to see which posts are still drafts. The public does not. */
  showStatus?: boolean
  /** Public recap cards use a square cover to match the event cards. */
  squareImage?: boolean
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
export default function PostCard({ post, to, showStatus = false, squareImage = false }: PostCardProps) {
  const cover = coverImage(post)
  const caption = stripHtml(post.description)

  return (
    <Link to={to} className="public-image-hover block h-full">
      <Card hover className="flex h-full flex-col overflow-hidden">
        <div className={`public-image-frame relative flex ${squareImage ? 'aspect-square' : 'aspect-[4/3]'} items-center justify-center overflow-hidden bg-surface-container text-muted`}>
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

        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            {showStatus && !post.published && <StatusBadge status="Draft" />}
            <span className="text-sm text-muted">{formatPostDate(post.post_date)}</span>
          </div>

          <h2 className="line-clamp-1 h-7 text-lg font-semibold leading-snug text-on-surface">
            {postDisplayTitle(post)}
          </h2>

          <p className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Icon name="location_on" className="text-[18px]" />
            <span className="truncate">{post.location?.trim() || 'Location not specified'}</span>
          </p>

          {caption && (
            <p className="line-clamp-2 text-sm text-muted">
              {/* Captions are stored as sanitised HTML. This is a preview, so
                  it wants the words only - and never innerHTML, which would
                  render markup in the middle of a card. */}
              {caption.length > CAPTION_PREVIEW_LENGTH
                ? `${caption.slice(0, CAPTION_PREVIEW_LENGTH).trimEnd()}...`
                : caption}
            </p>
          )}

        </div>
      </Card>
    </Link>
  )
}
