import { afterEach, describe, expect, it, vi } from 'vitest'
import { embeddedSnapshotScript, parseLandingSnapshot, renderLandingMarkup } from './landing-server'
import { initialLandingSnapshot, type LandingSnapshot } from './services/landingSnapshot'

const snapshot: LandingSnapshot = {
  version: 1,
  partners: [{ id: 'partner-1', name: 'Snapshot Partner', image: null }],
  event: null,
  recaps: [{
    id: 'recap-1', title: 'Snapshot recap', description: 'Photos from the meetup', location: null,
    post_date: '2026-11-01', image: null,
  }],
  articles: [{
    id: 'article-1', title: 'Snapshot article', slug: 'snapshot-article', excerpt: 'Excerpt',
    author: null, published_at: '2026-11-02T00:00:00Z', updated_at: null, image: null,
  }],
  stats: { events: 1, contributors: 2, partners: 1 },
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.getElementById('landing-snapshot')?.remove()
})

describe('landing static render', () => {
  it('renders the page shell and data placeholders without requesting data', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    const markup = await renderLandingMarkup()

    expect(markup).toContain('id="landing-intro-title"')
    expect(markup).toContain('aria-label="Loading upcoming event"')
    expect(markup).toContain('aria-label="Loading past events"')
    expect(markup).toContain('aria-label="Loading articles"')
    expect(markup).toContain('Davao DeFi Community photos')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('renders every section in place, with no streamed placeholders or inline scripts', async () => {
    const markup = await renderLandingMarkup(snapshot)

    expect(markup).not.toContain('<template')
    expect(markup).not.toMatch(/<script(?![^>]*type="application\/ld\+json")/)
    expect(markup).toContain('Who can join?')
  })

  it('renders the published snapshot content instead of placeholders', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    const markup = await renderLandingMarkup(snapshot)

    expect(markup).toContain('Snapshot article')
    expect(markup).toContain('Snapshot recap')
    expect(markup).not.toContain('aria-label="Loading articles"')
    expect(markup).not.toContain('aria-label="Loading past events"')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not leak the build snapshot into later renders', async () => {
    await renderLandingMarkup(snapshot)
    const markup = await renderLandingMarkup()
    expect(markup).not.toContain('Snapshot article')
  })
})

describe('embedded landing snapshot', () => {
  it('round-trips through the page and escapes "<"', () => {
    const tricky = { ...snapshot, articles: [{ ...snapshot.articles[0], title: '</script><b>x</b>' }] }
    const script = embeddedSnapshotScript(tricky)
    expect(script.match(/<\/script>/g)).toHaveLength(1)

    document.head.insertAdjacentHTML('beforeend', script)
    expect(initialLandingSnapshot()?.articles[0].title).toBe('</script><b>x</b>')
  })

  it('ignores an embedded snapshot that is malformed or invalid', () => {
    document.head.insertAdjacentHTML('beforeend', '<script type="application/json" id="landing-snapshot">{not json</script>')
    expect(initialLandingSnapshot()).toBeUndefined()
    document.getElementById('landing-snapshot')?.remove()

    document.head.insertAdjacentHTML('beforeend', '<script type="application/json" id="landing-snapshot">{"version":2}</script>')
    expect(initialLandingSnapshot()).toBeUndefined()
    expect(parseLandingSnapshot({ version: 2 })).toBeNull()
  })
})
