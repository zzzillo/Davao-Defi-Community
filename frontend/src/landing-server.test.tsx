import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderLandingMarkup } from './landing-server'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('landing static render', () => {
  it('renders the page shell and dynamic placeholders without requesting data', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    const markup = await renderLandingMarkup()

    expect(markup).toContain('id="landing-intro-title"')
    expect(markup).toContain('aria-label="Loading community updates"')
    expect(markup).toContain('aria-label="Loading upcoming event"')
    expect(markup).toContain('aria-label="Loading past events"')
    expect(markup).toContain('aria-label="Loading articles"')
    expect(markup).toContain('Davao DeFi Community photos')
    expect(fetch).not.toHaveBeenCalled()
  })
})
