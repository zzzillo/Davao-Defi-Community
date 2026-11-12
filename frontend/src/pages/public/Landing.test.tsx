import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthUnavailableProvider } from '../../auth/appAuth'
import { ToastProvider } from '../../components/Toast'
import Landing from './Landing'

const snapshotUrl = 'https://media.example.test/landing/v1/snapshot.json'
const photo = {
  src: 'https://media.example.test/cover.webp',
  variants: [{ url: 'https://media.example.test/cover-small.webp', width: 480 }],
}
const snapshot = {
  version: 1,
  partners: [{ id: 'partner', name: 'Snapshot partner', image: photo }],
  event: {
    id: 'event', title: 'Snapshot event', description: 'Meet the community', location: 'Davao',
    start_datetime: '2026-11-13T00:00:00Z', end_datetime: null, kind: 'upcoming', image: photo,
  },
  recaps: [{ id: 'recap', title: 'Snapshot recap', description: '', location: null, post_date: '2026-11-02', image: photo }],
  articles: [{ id: 'article', slug: 'snapshot-article', title: 'Snapshot article', excerpt: 'Read the news', author: 'Community', published_at: '2026-11-03T00:00:00Z', updated_at: null, image: photo }],
  stats: { events: 17, contributors: 29, partners: 43 },
}

function openLanding(path: string) {
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <AuthUnavailableProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/landing.html" element={<Landing />} />
            </Routes>
          </ToastProvider>
        </AuthUnavailableProvider>
      </MemoryRouter>
    </StrictMode>,
  )
}

beforeEach(() => {
  vi.stubEnv('VITE_LANDING_SNAPSHOT_URL', snapshotUrl)
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('landing snapshot', () => {
  it.each(['/', '/landing.html'])('renders all five sections from one CDN request on %s', async (path) => {
    const fetch = vi.fn(async (url: string) => {
      if (url !== snapshotUrl) throw new Error(`Unexpected backend request: ${url}`)
      return Response.json(snapshot)
    })
    vi.stubGlobal('fetch', fetch)
    openLanding(path)

    expect((await screen.findByRole('img', { name: 'Snapshot partner logo' })).getAttribute('srcset')).toContain('480w')
    expect((await screen.findByText('Snapshot event')).closest('a')?.getAttribute('href')).toBe('/events/event')
    expect((await screen.findByText('Snapshot recap')).closest('a')?.getAttribute('href')).toBe('/recaps/recap')
    expect((await screen.findByText('Snapshot article')).closest('a')?.getAttribute('href')).toBe('/blog/snapshot-article')
    expect(await screen.findByText('29')).toBeDefined()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries an invalid snapshot through the same static URL', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ version: 2 })).mockResolvedValueOnce(Response.json(snapshot))
    vi.stubGlobal('fetch', fetch)
    openLanding('/')

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([snapshotUrl, snapshotUrl])
    expect(await screen.findByText('Snapshot event')).toBeDefined()
  })
})
