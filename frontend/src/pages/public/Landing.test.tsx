import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthUnavailableProvider } from '../../auth/appAuth'
import { ToastProvider } from '../../components/Toast'
import Landing from './Landing'

const snapshotUrl = 'https://media.example.test/landing/v1/snapshot.json'
const fallbackUrl = 'http://127.0.0.1:8000/landing/v1/fallback.json'
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
  it.each(['/', '/landing.html'])('renders the snapshot sections without requesting fallback on %s', async (path) => {
    const fetch = vi.fn(async (url: string) => {
      if (url !== snapshotUrl) throw new Error(`Unexpected backend request: ${url}`)
      return Response.json(snapshot)
    })
    vi.stubGlobal('fetch', fetch)
    openLanding(path)

    expect((await screen.findByRole('img', { name: 'Snapshot partner logo' })).getAttribute('srcset')).toContain('480w')
    expect((await screen.findByText('Snapshot event')).closest('a')?.getAttribute('href')).toBe('/rsvp/event')
    expect((await screen.findByText('Snapshot recap')).closest('a')?.getAttribute('href')).toBe('/events/recap')
    expect(screen.getByRole('link', { name: 'Check Events' }).getAttribute('href')).toBe('/events')
    expect(screen.getByRole('region', { name: 'Upcoming RSVP' })).toBeDefined()
    expect(document.querySelector('[aria-label="Published Events"] .grid')?.className).toContain('sm:grid-cols-2')
    expect((await screen.findByText('Snapshot article')).closest('a')?.getAttribute('href')).toBe('/blog/snapshot-article')
    expect(await screen.findByText('29')).toBeDefined()
    expect(fetch.mock.calls.filter(([url]) => url === snapshotUrl)).toHaveLength(1)
    expect(fetch.mock.calls.some(([url]) => url === fallbackUrl)).toBe(false)
  })

  it('retries an invalid snapshot through the same static URL', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ version: 2 }))
      .mockResolvedValueOnce(Response.json({ version: 2 }))
      .mockResolvedValueOnce(Response.json(snapshot))
    vi.stubGlobal('fetch', fetch)
    openLanding('/')

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([snapshotUrl, fallbackUrl, snapshotUrl])
    expect(await screen.findByText('Snapshot event')).toBeDefined()
  })

  it('uses the backend content and local partner logos after the snapshot fails', async () => {
    const fallbackSnapshot = {
      ...snapshot,
      partners: [
        { id: '4190996e-8a68-4178-8a29-97f380734ee3', name: 'CertiK', image: photo },
        { id: '3e03ef6c-9fec-44a7-a944-ec92afaa6512', name: 'Bitskwela', image: photo },
      ],
    }
    const fetch = vi.fn(async (url: string) => {
      if (url === snapshotUrl) throw new DOMException('Snapshot timed out', 'TimeoutError')
      if (url === fallbackUrl) return Response.json(fallbackSnapshot)
      if (url === 'http://127.0.0.1:8000/events?upcoming=true&limit=1') return new Response('unavailable', { status: 503 })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetch)
    openLanding('/')

    const certik = await screen.findByRole('img', { name: 'CertiK logo' })
    const bitskwela = await screen.findByRole('img', { name: 'Bitskwela logo' })
    expect(certik.getAttribute('src')).toContain('4190996e-8a68-4178-8a29-97f380734ee3.webp')
    expect(bitskwela.getAttribute('src')).toContain('3e03ef6c-9fec-44a7-a944-ec92afaa6512.webp')
    expect(await screen.findByText('Snapshot event')).toBeDefined()
    expect(fetch.mock.calls.filter(([url]) => url === snapshotUrl || url === fallbackUrl).map(([url]) => url))
      .toEqual([snapshotUrl, fallbackUrl])
  })

  it('shows local logos and a retry option when both data sources fail', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url === snapshotUrl) return new Response('unavailable', { status: 503 })
      if (url === fallbackUrl) return new Response('unavailable', { status: 503 })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetch)
    openLanding('/')

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeDefined()
    expect(await screen.findByRole('img', { name: 'Bitskwela logo' })).toBeDefined()
    expect(screen.getByText('Community updates are temporarily unavailable.')).toBeDefined()
  })

  it('hides the RSVP feature panel when there is no upcoming RSVP', async () => {
    const fetch = vi.fn(async () => Response.json({ ...snapshot, event: null }))
    vi.stubGlobal('fetch', fetch)
    openLanding('/')

    await screen.findByText('Snapshot recap')
    expect(screen.queryByRole('region', { name: 'Upcoming RSVP' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Check Events' }).getAttribute('href')).toBe('/events')
  })
})
