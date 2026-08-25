/**
 * Turning a post from the API into things a person can read.
 *
 * Pure functions: no React, no fetch. Components render with them and they can
 * be reasoned about on their own.
 */

import type { PostResponse } from '../types/post'

/**
 * "Aug 15, 2026" from a "YYYY-MM-DD" post_date, in the reader's own locale.
 *
 * The whole reason this exists rather than reusing formatEventDay:
 *
 *   new Date("2026-08-15")     in Los Angeles -> Aug 14   WRONG
 *   new Date(2026, 7, 15)      in Los Angeles -> Aug 15   right
 *
 * A date-only *string* is parsed as UTC midnight and then rendered in local
 * time, so it slips backwards anywhere west of UTC. The same constructor given
 * separate *numbers* is interpreted as local time, and the digits survive.
 *
 * So the danger is new Date(string), not new Date. Splitting the parts first is
 * what makes it safe - and is why post_date must never be handed to the
 * formatter that events use, which takes an instant.
 */
export function formatPostDate(postDate: string): string {
  const [year, month, day] = postDate.split('-').map(Number)

  // A malformed value renders as itself rather than as "Invalid Date".
  if (!year || !month || !day) return postDate

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * What to print as the post's heading.
 *
 * title is optional in the API, because a gallery does not always need one.
 * When it is missing, a linked event supplies a better fallback than the word
 * "Untitled" ever could.
 */
export function postDisplayTitle(post: PostResponse): string {
  if (post.title) return post.title

  if (post.event) return `${post.event.title} Recap`

  return 'Untitled post'
}

/** "12 photos", "1 photo", "No photos" - a caption, not a number. */
export function imageCountLabel(count: number): string {
  if (count === 0) return 'No photos'

  return count === 1 ? '1 photo' : `${count} photos`
}

/**
 * The image to show when only one can be shown.
 *
 * The API already orders the gallery, so the cover is simply the first one -
 * which also means reordering in the form changes the cover, with no separate
 * "is cover" flag to keep in sync.
 */
export function coverImage(post: PostResponse) {
  return post.images[0] ?? null
}
