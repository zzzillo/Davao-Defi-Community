import { Link } from 'react-router-dom'

import Icon from '../Icon'
import type { BlogSummary } from '../../types/blog'
import { blogDateLabel } from '../../utils/blog'

type BlogCardProps = {
  blog: BlogSummary
  /** Where the headline links to - the admin editor or the public article. */
  to: string
  /** Show a Draft badge. On for officials, off for the public list. */
  showStatus?: boolean
}

/**
 * One article in a list: headline, summary, byline, cover.
 *
 * Text-first, which is the whole difference from PostCard. A post card is a
 * photograph with a caption underneath; this is a headline with a picture
 * beside it, and the picture is allowed to be missing without the card looking
 * broken.
 *
 * Takes a BlogSummary, not a BlogResponse. A list never has article bodies -
 * see types/blog.ts - and the type makes reaching for one a compile error
 * rather than a blank space on the page.
 */
export default function BlogCard({ blog, to, showStatus = false }: BlogCardProps) {
  return (
    <article className="group border-b border-outline py-8 last:border-b-0">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {blog.creator && (
              <>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container text-[10px] font-semibold text-on-surface-variant">
                  {blog.creator.display_name
                    .split(' ')
                    .map((word) => word[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <span className="font-medium text-on-surface">
                  {blog.creator.display_name}
                </span>
                <span className="text-on-surface-variant">·</span>
              </>
            )}
            <span className="text-on-surface-variant">{blogDateLabel(blog)}</span>
          </div>

          <h2 className="mt-2.5 text-2xl font-bold leading-snug tracking-tight text-on-surface">
            <Link to={to} className="transition-opacity hover:opacity-70">
              {blog.title}
            </Link>
          </h2>

          {blog.excerpt && (
            <p className="mt-1.5 line-clamp-2 text-base text-on-surface-variant">
              {/*
                Rendered as text, not markup. The backend strips every tag from
                an excerpt on write precisely so this is safe and so the same
                string can go into a meta description unchanged.
              */}
              {blog.excerpt}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            {showStatus && !blog.published && (
              <span className="inline-flex items-center rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                Draft
              </span>
            )}

            <span className="truncate text-xs text-muted">/blog/{blog.slug}</span>
          </div>
        </div>

        {/*
          The cover, or a placeholder. A fixed box either way, so a list of
          articles with and without covers still lines up - a card that changes
          width depending on whether an image loaded is worse than a grey box.
        */}
        <div className="flex h-28 w-44 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container text-muted">
          {blog.cover_image_url ? (
            <img
              src={blog.cover_image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon name="article" className="text-[30px]" />
          )}
        </div>
      </div>
    </article>
  )
}
