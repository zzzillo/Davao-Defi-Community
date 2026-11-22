/**
 * Vercel Routing Middleware: page metadata and 404s for crawlers.
 *
 * People never reach the logic below - a request without a crawler user agent
 * continues to the app immediately. See src/edge/crawlerPages.ts for what each
 * kind of crawler receives and why.
 */

import {
  classifyCrawler,
  isStaticFile,
  loadPage,
  matchRoute,
  normalizePath,
  renderNotFoundHtml,
  renderPreviewHtml,
} from './src/edge/crawlerPages'

export const config = {
  // Static assets, proxied media and the landing snapshot are never pages.
  matcher: ['/((?!assets/|r2/|landing/v1/).*)'],
}

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
