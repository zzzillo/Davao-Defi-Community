/**
 * Vercel Routing Middleware: page metadata and 404s for crawlers.
 *
 * SELF-CONTAINED ON PURPOSE: this file must not import anything from the repo.
 * Vercel compiles it on its own and runs it with plain Node ESM resolution, so
 * an import such as './src/edge/crawlerPages' (no file extension) fails to load
 * and every request on the site returns 500 MIDDLEWARE_INVOCATION_FAILED. That
 * happened in production on 2026-11-22. src/edge/middleware.test.ts fails if a
 * relative import comes back, and checks that the few helpers copied here still
 * match the app's own (src/utils/pageMeta.ts, src/utils/blog.ts,
 * src/utils/publicPaths.ts).
 *
 * The site is a single-page app: every address serves the same HTML shell and
 * the page's title, description and share image are set by JavaScript. Search
 * engines run that JavaScript; link-preview bots (Facebook, X, Telegram,
 * Discord, Slack, LinkedIn, WhatsApp...) do not, so a shared article would
 * otherwise preview as the generic site card.
 *
 * - People pass straight through: a request without a crawler user agent
 *   continues to the app immediately.
 * - Link-preview bots on an article, event gallery, RSVP or contributor page
 *   get a small HTML document carrying that page's own metadata.
 * - Crawlers get a real 404 for an address no route matches, or for content
 *   the API reports as missing, and a 301 from an outdated event address.
 * - When the API is slow or failing, everyone gets the normal app.
 */

export const config = {
  // Static assets, proxied media and the landing snapshot are never pages.
  matcher: ['/((?!assets/|r2/|landing/v1/).*)'],
}

// ---------------------------------------------------------------------------
// Copies of app helpers (kept identical by src/edge/middleware.test.ts)
// ---------------------------------------------------------------------------

/** Same as src/utils/pageMeta.ts. */
export const SITE_URL = 'https://davaodeficommunity.com'
export const SITE_NAME = 'Davao DeFi Community'
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`
const DESCRIPTION_MAX_LENGTH = 160

export function absoluteUrl(url: string): string {
  return new URL(url, SITE_URL).toString()
}

/** Same as toMetaDescription in src/utils/pageMeta.ts. */
export function toMetaDescription(text: string | null | undefined): string | null {
  const plain = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!plain) return null
  if (plain.length <= DESCRIPTION_MAX_LENGTH) return plain
  const cut = plain.slice(0, DESCRIPTION_MAX_LENGTH - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–—-]+$/, '')}…`
}

/** Same as slugify in src/utils/blog.ts (and app/services/slug_service.py). */
const SLUG_MAX_BASE_LENGTH = 200
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
  if (lastHyphen === -1) return cut
  const trimmed = cut.slice(0, lastHyphen)
  return trimmed.length >= SLUG_MAX_BASE_LENGTH / 2 ? trimmed : cut.replace(/-+$/, '')
}

/** Same as src/utils/publicPaths.ts. */
function titledPath(prefix: string, id: string, title: string | null): string {
  const base = `${prefix}/${encodeURIComponent(id)}`
  const slug = title ? slugify(title) : ''
  return slug ? `${base}/${slug}` : base
}
export const eventGalleryPath = (id: string, title: string | null) => titledPath('/events', id, title)
export const rsvpPath = (id: string, title: string | null) => titledPath('/rsvp', id, title)

// ---------------------------------------------------------------------------
// Crawler handling
// ---------------------------------------------------------------------------

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
// Event galleries and RSVPs may carry a title slug after the id.
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
        path: eventGalleryPath(key, text(data.title)),
        image: text(images[0]?.image_url),
        type: 'website',
      }
    }
    case 'event':
      return {
        title: text(data.title) ?? 'Event',
        description: htmlToText(text(data.description)),
        path: rsvpPath(key, text(data.title)),
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

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Continue to the normal response. Identical to `next()` from
 * @vercel/functions 3.10.6 (middleware.js), inlined because that package pulls
 * in 18 transitive dependencies for this one line.
 */
function next(): Response {
  return new Response(null, { headers: { 'x-middleware-next': '1' } })
}

function html(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Crawler-only responses must never be cached and replayed to a person.
      'cache-control': 'private, no-store',
      vary: 'user-agent',
      ...(status === 404 ? { 'x-robots-tag': 'noindex' } : {}),
    },
  })
}

export default async function middleware(request: Request): Promise<Response> {
  const crawler = classifyCrawler(request.headers.get('user-agent'))
  if (!crawler) return next()

  const { pathname } = new URL(request.url)
  if (isStaticFile(pathname)) return next()

  const route = matchRoute(pathname)
  if (route.kind === 'unknown') return html(renderNotFoundHtml(), 404)
  if (route.kind === 'app') return next()

  const result = await loadPage(route)
  if (result.status === 'missing') return html(renderNotFoundHtml(), 404)
  // An old or slug-less address (a renamed event, a bare /rsvp/<id>) sends
  // crawlers to the current one permanently; people get the same move in the app.
  if (result.status === 'found' && normalizePath(pathname) !== result.page.path) {
    return new Response(null, {
      status: 301,
      headers: { location: result.page.path, 'cache-control': 'private, no-store', vary: 'user-agent' },
    })
  }
  if (result.status === 'found' && crawler === 'preview') return html(renderPreviewHtml(result.page), 200)
  // Search engines render the app's own metadata and structured data.
  return next()
}
