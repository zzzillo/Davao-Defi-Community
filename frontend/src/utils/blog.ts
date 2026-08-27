/**
 * Turning a blog from the API into things a person can read, and a title into
 * the URL it is about to get.
 *
 * Pure functions: no React, no fetch. Components render with them and they can
 * be reasoned about on their own.
 */

import type { BlogSummary } from '../types/blog'

/** Matches app/services/slug_service.py. See the warning on slugify below. */
const SLUG_MAX_BASE_LENGTH = 200

/** Roughly the pace of an adult reading for comprehension, not skimming. */
const WORDS_PER_MINUTE = 220

/**
 * A title reduced to a URL-safe slug.
 *
 * A DELIBERATE SECOND IMPLEMENTATION of app/services/slug_service.py, and the
 * only duplication in this module that is not a mistake. The form needs to
 * show the author what their address will look like while they type, and a
 * request per keystroke to find out is not a reasonable trade.
 *
 * So this is a PREVIEW and the backend is the authority. Two things follow,
 * and both matter:
 *
 * - the server may return a different slug than this predicted, because it
 *   also resolves collisions - "understanding-web3" becomes
 *   "understanding-web3-2" if one already exists. The form shows what comes
 *   back, not what it guessed.
 * - if the two ever disagree on the *rules*, the server wins and the request
 *   is rejected with a 422. That is the safe direction for them to disagree
 *   in: a visible error rather than a silently wrong URL.
 *
 * normalize('NFD') plus a combining-marks strip is the JavaScript equivalent
 * of Python's NFKD-then-encode-ASCII: it splits an accented character into its
 * base letter and its accent, and the accent is then removed rather than the
 * whole letter. So "Café" gives "cafe", not "caf".
 *
 * Returns "" for a title with no ASCII in it at all - one written entirely in
 * Chinese, or in emoji. The caller must handle that; the server falls back to
 * blog-<token>, which is what the form should say it will do.
 */
export function slugify(value: string): string {
  const ascii = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')

  const hyphenated = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (hyphenated.length <= SLUG_MAX_BASE_LENGTH) return hyphenated

  const cut = hyphenated.slice(0, SLUG_MAX_BASE_LENGTH)
  const lastHyphen = cut.lastIndexOf('-')

  // The -1 check is load-bearing. Without it, slice(0, -1) means "all but the
  // last character" rather than "nothing", so a title that is one enormous
  // word came back one character shorter than the backend produced for the
  // same input - which a preview must never do.
  if (lastHyphen === -1) return cut

  const trimmed = cut.slice(0, lastHyphen)

  // Same guard as the backend: a title with no usable boundary takes the hard
  // cut, because losing half a word beats losing the whole slug.
  return trimmed.length >= SLUG_MAX_BASE_LENGTH / 2 ? trimmed : cut.replace(/-+$/, '')
}

/**
 * "27 August 2026" from an ISO instant, in the reader's own locale.
 *
 * Safe to hand an ISO string to `new Date`, unlike a post's post_date: this
 * value carries a UTC offset, so there is a real instant to convert. The trap
 * documented in utils/post.ts applies to date-only strings, which this is not.
 */
export function formatPublishedDate(iso: string): string {
  const date = new Date(iso)

  if (Number.isNaN(date.getTime())) return iso

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** What to show under a headline: the publication date, or the draft's age. */
export function blogDateLabel(blog: BlogSummary): string {
  if (blog.published && blog.published_at) {
    return `Published ${formatPublishedDate(blog.published_at)}`
  }

  return `Last edited ${formatPublishedDate(blog.updated_at)}`
}

/**
 * "6 min read", derived from the article rather than stored on it.
 *
 * Derived on purpose. A stored reading time goes stale the moment somebody
 * edits the body, and nothing would notice - it would simply be wrong forever.
 * The cost of recomputing is a regex over a string that is already in memory.
 *
 * Counts words in the text, not the markup, so a paragraph full of links does
 * not read as twice its length.
 */
export function readingTime(html: string | null): string {
  const words = htmlToText(html).split(/\s+/).filter(Boolean).length

  if (words === 0) return 'Empty'

  return `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read`
}

/**
 * The visible text of some HTML, with the tags removed.
 *
 * Uses the browser's own parser rather than a regex. A regex over markup gets
 * "<p>a<b>c</b></p>" wrong in ways that only show up on real content, and
 * every browser this runs in already has a correct HTML parser sitting in it.
 *
 * Parsing into a detached document, not into the live page: nothing here is
 * ever attached, so no script would run even if the string carried one - and
 * it cannot, because the backend sanitises on write.
 */
export function htmlToText(html: string | null): string {
  if (!html) return ''

  const parsed = new DOMParser().parseFromString(html, 'text/html')

  return (parsed.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * A suggested excerpt, taken from the start of the article.
 *
 * Offered as a one-click fill rather than applied automatically. The excerpt
 * is the card summary and the snippet a search engine prints, which is an
 * editorial decision - but an author staring at an empty box deserves a
 * starting point.
 *
 * Cut on a word boundary, because "...decentralised fina" reads as a bug.
 */
export function suggestExcerpt(html: string | null, maxLength = 300): string {
  const text = htmlToText(html)

  if (text.length <= maxLength) return text

  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')

  return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`
}
