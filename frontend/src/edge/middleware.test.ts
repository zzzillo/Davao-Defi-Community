/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as copy from '../../middleware'
import { slugify as appSlugify } from '../utils/blog'
import * as app from '../utils/pageMeta'
import { eventGalleryPath as appEventGalleryPath, rsvpPath as appRsvpPath } from '../utils/publicPaths'

import middleware, {
  API_ORIGIN,
  classifyCrawler,
  htmlToText,
  isStaticFile,
  loadPage,
  matchRoute,
  renderPreviewHtml,
} from '../../middleware'

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
const FACEBOOK = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function request(path: string, userAgent: string) {
  return new Request(`https://davaodeficommunity.com${path}`, { headers: { 'user-agent': userAgent } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('classifyCrawler', () => {
  it('separates people, link-preview bots and search crawlers', () => {
    expect(classifyCrawler(CHROME)).toBeNull()
    expect(classifyCrawler(null)).toBeNull()
    expect(classifyCrawler(FACEBOOK)).toBe('preview')
    expect(classifyCrawler('TelegramBot (like TwitterBot)')).toBe('preview')
    expect(classifyCrawler('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)')).toBe('preview')
    expect(classifyCrawler(GOOGLEBOT)).toBe('search')
    expect(classifyCrawler('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe('search')
  })
})

describe('matchRoute', () => {
  it('recognises the app routes from App.tsx', () => {
    for (const path of ['/', '/events', '/blogs/', '/join-us', '/admin', '/admin/blogs/new', '/sign-in/factor-one', '/recaps/abc', '/posts']) {
      expect(matchRoute(path), path).toEqual({ kind: 'app' })
    }
  })

  it('extracts detail keys and decodes them', () => {
    expect(matchRoute('/blog/hello-world')).toEqual({ kind: 'detail', resource: 'blog', key: 'hello-world' })
    expect(matchRoute('/events/3f2a')).toEqual({ kind: 'detail', resource: 'post', key: '3f2a' })
    expect(matchRoute('/rsvp/9c1b/')).toEqual({ kind: 'detail', resource: 'event', key: '9c1b' })
    expect(matchRoute('/contributors/ana%20cruz')).toEqual({ kind: 'detail', resource: 'contributor', key: 'ana cruz' })
  })

  it('accepts an optional title slug on event galleries and RSVPs', () => {
    expect(matchRoute('/events/3f2a/defi-meetup')).toEqual({ kind: 'detail', resource: 'post', key: '3f2a' })
    expect(matchRoute('/rsvp/9c1b/old-title/')).toEqual({ kind: 'detail', resource: 'event', key: '9c1b' })
    expect(matchRoute('/rsvp/9c1b/a/b')).toEqual({ kind: 'unknown' })
  })

  it('reports everything else as unknown', () => {
    for (const path of ['/blog', '/blog/a/b', '/wp-admin', '/about', '/contributors/%E0%A4%A']) {
      expect(matchRoute(path), path).toEqual({ kind: 'unknown' })
    }
  })

  it('treats files as static, except the landing document', () => {
    expect(isStaticFile('/robots.txt')).toBe(true)
    expect(isStaticFile('/og-image.jpg')).toBe(true)
    expect(isStaticFile('/landing.html')).toBe(false)
    expect(isStaticFile('/blog/web3.0-explained')).toBe(false)
  })
})

describe('loadPage', () => {
  const blogRoute = { kind: 'detail', resource: 'blog', key: 'hello' } as const

  it('maps an article from the public API', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      title: 'Hello', slug: 'hello', excerpt: 'Intro.', cover_image_url: 'https://davaodeficommunity.com/r2/c.webp',
    }))
    const result = await loadPage(blogRoute, fetcher)

    expect(fetcher).toHaveBeenCalledWith(`${API_ORIGIN}/blogs/slug/hello`, expect.anything())
    expect(result).toEqual({
      status: 'found',
      page: { title: 'Hello', description: 'Intro.', path: '/blog/hello', image: 'https://davaodeficommunity.com/r2/c.webp', type: 'article' },
    })
  })

  it('uses the first gallery photo and plain-text description for an event gallery', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      title: null, description: '<p>Talks &amp; demos</p>', images: [{ image_url: '/r2/a.webp' }, { image_url: '/r2/b.webp' }],
    }))
    const result = await loadPage({ kind: 'detail', resource: 'post', key: 'p1' }, fetcher)
    expect(result).toMatchObject({ status: 'found', page: { title: 'Untitled Event', image: '/r2/a.webp', path: '/events/p1' } })
    if (result.status === 'found') expect(result.page.description?.trim()).toBe('Talks & demos')
  })

  it('reports missing content only for 404 and 422', async () => {
    expect(await loadPage(blogRoute, vi.fn(async () => jsonResponse({}, 404)))).toEqual({ status: 'missing' })
    expect(await loadPage(blogRoute, vi.fn(async () => jsonResponse({}, 422)))).toEqual({ status: 'missing' })
    expect(await loadPage(blogRoute, vi.fn(async () => jsonResponse({}, 503)))).toEqual({ status: 'error' })
    expect(await loadPage(blogRoute, vi.fn(async () => jsonResponse({}, 429)))).toEqual({ status: 'error' })
    expect(await loadPage(blogRoute, vi.fn(async () => { throw new Error('timeout') }))).toEqual({ status: 'error' })
  })
})

describe('renderPreviewHtml', () => {
  it('escapes API text and makes image URLs absolute', () => {
    const output = renderPreviewHtml({
      title: '"Quotes" & <tags>', description: 'Line one', path: '/blog/x', image: '/r2/x.webp', type: 'article',
    })
    expect(output).toContain('<title>&quot;Quotes&quot; &amp; &lt;tags&gt; — Davao DeFi Community</title>')
    expect(output).toContain('<meta property="og:image" content="https://davaodeficommunity.com/r2/x.webp">')
    expect(output).toContain('<link rel="canonical" href="https://davaodeficommunity.com/blog/x">')
    expect(output).not.toContain('<tags>')
  })

  it('decodes entities when flattening HTML', () => {
    expect(htmlToText('<p>A &amp; B&#39;s &lt;3</p>').trim()).toBe("A & B's <3")
  })
})

describe('middleware', () => {
  it('lets people through without calling the API', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const response = await middleware(request('/blog/hello', CHROME))

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('gives link-preview bots the article metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ title: 'Hello', slug: 'hello', excerpt: 'Intro.' })))
    const response = await middleware(request('/blog/hello', FACEBOOK))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).toContain('<meta property="og:title" content="Hello — Davao DeFi Community">')
  })

  it('lets search engines render the app for existing content', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ title: 'Hello', slug: 'hello' })))
    const response = await middleware(request('/blog/hello', GOOGLEBOT))
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('answers crawlers with a real 404 for missing content and unknown addresses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: 'Not found' }, 404)))
    const missing = await middleware(request('/blog/gone', GOOGLEBOT))
    expect(missing.status).toBe(404)
    expect(missing.headers.get('x-robots-tag')).toBe('noindex')

    const unknown = await middleware(request('/no-such-page', GOOGLEBOT))
    expect(unknown.status).toBe(404)
  })

  it('redirects crawlers from a bare or outdated RSVP address to the current one', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ title: 'DeFi Meetup: Davao!' })))

    for (const path of ['/rsvp/e1', '/rsvp/e1/old-title']) {
      const response = await middleware(request(path, GOOGLEBOT))
      expect(response.status, path).toBe(301)
      expect(response.headers.get('location')).toBe('/rsvp/e1/defi-meetup-davao')
    }

    const current = await middleware(request('/rsvp/e1/defi-meetup-davao', FACEBOOK))
    expect(current.status).toBe(200)
    expect(await current.text()).toContain('<link rel="canonical" href="https://davaodeficommunity.com/rsvp/e1/defi-meetup-davao">')
  })

  it('serves the normal app when the API fails, never a 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    const response = await middleware(request('/blog/hello', FACEBOOK))
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('leaves static files and app pages alone', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    for (const path of ['/robots.txt', '/sitemap.xml', '/', '/blogs', '/admin']) {
      const response = await middleware(request(path, GOOGLEBOT))
      expect(response.headers.get('x-middleware-next'), path).toBe('1')
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('middleware.ts stays deployable and in step with the app', () => {
  it('imports nothing from the repo (Vercel loads it unbundled; see the file header)', () => {
    const source = readFileSync(join(__dirname, '../../middleware.ts'), 'utf8')
    const imports = [...source.matchAll(/^\s*(?:import|export)\b[^;'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]/gm)]
      .map((match) => match[1] ?? match[2])
    expect(imports.filter((specifier) => specifier.startsWith('.') || specifier.startsWith('/'))).toEqual([])
  })

  it('keeps its copied helpers identical to the app versions', () => {
    expect(copy.SITE_URL).toBe(app.SITE_URL)
    expect(copy.SITE_NAME).toBe(app.SITE_NAME)
    expect(copy.DEFAULT_IMAGE).toBe(app.DEFAULT_IMAGE)

    const titles = [
      'Understanding Web3 - A Primer!', 'Café Ñoño: DeFi & NFTs', 'Sundown Avalanche — Night 2!',
      '活动', '', '   ', 'a'.repeat(250), `${'word '.repeat(60)}end`, 'DeFi Meetup @ Ateneo',
    ]
    for (const title of titles) {
      expect(copy.slugify(title), title).toBe(appSlugify(title))
      expect(copy.toMetaDescription(title), title).toBe(app.toMetaDescription(title))
      expect(copy.eventGalleryPath('p1', title || null), title).toBe(appEventGalleryPath({ id: 'p1', title: title || null }))
      expect(copy.rsvpPath('e1', title || null), title).toBe(appRsvpPath({ id: 'e1', title: title || null }))
    }
    expect(copy.absoluteUrl('/r2/x.webp')).toBe(app.absoluteUrl('/r2/x.webp'))
  })
})
