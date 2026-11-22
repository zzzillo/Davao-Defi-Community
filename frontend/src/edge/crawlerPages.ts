/**
 * What crawlers get from frontend/middleware.ts.
 *
 * The site is a single-page app: every address serves the same HTML shell and
 * the page's title, description and share image are set by JavaScript. Search
 * engines run that JavaScript; link-preview bots (Facebook, X, Telegram,
 * Discord, Slack, LinkedIn, WhatsApp...) do not, so a shared article would
 * otherwise preview as the generic site card.
 *
 * - Link-preview bots on an article, event gallery, RSVP or contributor page
 *   get a small HTML document carrying that page's own metadata.
 * - Any crawler gets a real 404 for an address no route matches, or for
 *   content the API reports as missing, instead of a "200" empty shell.
 * - Everyone else, and every case where the API is slow or failing, gets the
 *   normal app untouched.
 *
 * Pure functions only, so they run in the middleware and in Vitest alike.
 */

import { absoluteUrl, DEFAULT_IMAGE, SITE_NAME, toMetaDescription } from '../utils/pageMeta'
import { eventGalleryPath, rsvpPath } from '../utils/publicPaths'

export const API_ORIGIN = 'https://api.davaodeficommunity.com'
const API_TIMEOUT_MS = 3000

export type Crawler = 'preview' | 'search'

const PREVIEW_BOTS = /facebookexternalhit|facebookcatalog|meta-externalagent|Twitterbot|Slackbot|Slack-ImgProxy|TelegramBot|Discordbot|WhatsApp|LinkedInBot|SkypeUriPreview|Embedly|redditbot|Pinterestbot|vkShare|Iframely|Mastodon|Bluesky|Viber|Line\//i
const SEARCH_BOTS = /Googlebot|Google-InspectionTool|Storebot-Google|bingbot|DuckDuckBot|YandexBot|Baiduspider|Applebot|PetalBot|SeznamBot|Yeti|Sogou/i

export function classifyCrawler(userAgent: string | null): Crawler | null {
  if (!userAgent) return null
  if (PREVIEW_BOTS.test(userAgent)) return 'preview'
  if (SEARCH_BOTS.test(userAgent)) return 'search'
  return null
}

export type Resource = 'blog' | 'post' | 'event' | 'contributor'

export type RouteMatch =
  | { kind: 'app' }
  | { kind: 'detail'; resource: Resource; key: string }
  | { kind: 'unknown' }

/** Pages the app renders from its own code, mirroring the routes in App.tsx. */
const APP_PAGES = new Set(['/', '/landing.html', '/events', '/blogs', '/contributors', '/partners', '/join-us', '/recaps', '/posts'])
const APP_SECTIONS = /^\/(admin|sign-in|sign-up|reset-password|recaps|posts)(\/|$)/
// Event galleries and RSVPs may carry a title slug after the id (utils/publicPaths.ts).
const DETAIL_ROUTES: [RegExp, Resource][] = [
  [/^\/blog\/([^/]+)$/, 'blog'],
  [/^\/events\/([^/]+)(?:\/[^/]+)?$/, 'post'],
  [/^\/rsvp\/([^/]+)(?:\/[^/]+)?$/, 'event'],
  [/^\/contributors\/([^/]+)$/, 'contributor'],
]

/** The request path without a trailing slash, as page paths are written. */
export function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

export function matchRoute(rawPathname: string): RouteMatch {
  const pathname = normalizePath(rawPathname)
  if (APP_PAGES.has(pathname) || APP_SECTIONS.test(pathname)) return { kind: 'app' }
  for (const [pattern, resource] of DETAIL_ROUTES) {
    const match = pathname.match(pattern)
    if (!match) continue
    try {
      return { kind: 'detail', resource, key: decodeURIComponent(match[1]) }
    } catch {
      return { kind: 'unknown' }
    }
  }
  return { kind: 'unknown' }
}

/** A path with a file extension is a static file, not a page. */
export function isStaticFile(pathname: string): boolean {
  return /\/[^/]+\.[A-Za-z0-9]+$/.test(pathname) && pathname !== '/landing.html'
}

export type PageInfo = {
  title: string
  description: string | null
  path: string
  image: string | null
  type: 'website' | 'article'
}

export type LoadResult =
  | { status: 'found'; page: PageInfo }
  | { status: 'missing' }
  | { status: 'error' }

type Json = Record<string, unknown>

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null)

/** Rich-text HTML to plain text without a DOM: tags become spaces, common entities are decoded. */
export function htmlToText(html: string | null): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const ENDPOINTS: Record<Resource, (key: string) => string> = {
  blog: (key) => `/blogs/slug/${encodeURIComponent(key)}`,
  post: (key) => `/posts/${encodeURIComponent(key)}`,
  event: (key) => `/events/${encodeURIComponent(key)}`,
  contributor: (key) => `/users/contributors/${encodeURIComponent(key)}`,
}

export function toPageInfo(resource: Resource, key: string, data: Json): PageInfo {
  switch (resource) {
    case 'blog':
      return {
        title: text(data.title) ?? 'Article',
        description: text(data.excerpt),
        path: `/blog/${encodeURIComponent(text(data.slug) ?? key)}`,
        image: text(data.cover_image_url),
        type: 'article',
      }
    case 'post': {
      const images = Array.isArray(data.images) ? (data.images as Json[]) : []
      return {
        title: text(data.title) ?? 'Untitled Event',
        description: htmlToText(text(data.description)),
        path: eventGalleryPath({ id: key, title: text(data.title) }),
        image: text(images[0]?.image_url),
        type: 'website',
      }
    }
    case 'event':
      return {
        title: text(data.title) ?? 'Event',
        description: htmlToText(text(data.description)),
        path: rsvpPath({ id: key, title: text(data.title) }),
        image: text(data.banner_image_url),
        type: 'website',
      }
    case 'contributor': {
      const name = text(data.display_name) ?? 'Contributor'
      return {
        title: name,
        description: text(data.bio) ?? `${name} is a contributor to the Davao DeFi Community.`,
        path: `/contributors/${encodeURIComponent(text(data.public_slug) ?? key)}`,
        image: text(data.profile_photo_url),
        type: 'website',
      }
    }
  }
}

/**
 * Ask the public API for the page's content. Any failure other than a clear
 * "does not exist" is reported as an error so the caller serves the normal
 * app: a slow or broken API must never turn a real page into a 404.
 */
export async function loadPage(
  route: Extract<RouteMatch, { kind: 'detail' }>,
  fetcher: typeof fetch = fetch,
): Promise<LoadResult> {
  try {
    const response = await fetcher(`${API_ORIGIN}${ENDPOINTS[route.resource](route.key)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
    // 422 is FastAPI rejecting a malformed id, which cannot name a real page either.
    if (response.status === 404 || response.status === 422) return { status: 'missing' }
    if (!response.ok) return { status: 'error' }
    return { status: 'found', page: toPageInfo(route.resource, route.key, (await response.json()) as Json) }
  } catch {
    return { status: 'error' }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** A complete document for a link-preview bot: the same title, summary and image a reader sees. */
export function renderPreviewHtml(page: PageInfo): string {
  const title = `${page.title} — ${SITE_NAME}`
  const description = toMetaDescription(page.description)
  const url = absoluteUrl(page.path)
  const image = page.image ? absoluteUrl(page.image) : DEFAULT_IMAGE
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    description ? `<meta name="description" content="${escapeHtml(description)}">` : '',
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:type" content="${page.type}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    description ? `<meta property="og:description" content="${escapeHtml(description)}">` : '',
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:locale" content="en_PH">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="@DavaoDefi">`,
  ].filter(Boolean)
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    ...tags,
    '</head>',
    '<body>',
    `<h1>${escapeHtml(page.title)}</h1>`,
    description ? `<p>${escapeHtml(description)}</p>` : '',
    `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
    '</body>',
    '</html>',
    '',
  ].filter((line) => line !== '').join('\n')
}

export function renderNotFoundHtml(): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>Page not found — ${SITE_NAME}</title>`,
    '<meta name="robots" content="noindex">',
    '</head>',
    '<body>',
    '<h1>Page not found</h1>',
    `<p><a href="${absoluteUrl('/')}">${SITE_NAME}</a></p>`,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}
