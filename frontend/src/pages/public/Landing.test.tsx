import { cleanup, render, screen } from '@testing-library/react'
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
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('landing snapshot', () => {
  it('keeps the static shell and section placeholders visible while the snapshot is pending', async () => {
    let resolveSnapshot: ((response: Response) => void) | undefined
    const pendingSnapshot = new Promise<Response>((resolve) => { resolveSnapshot = resolve })
    const fetch = vi.fn(() => pendingSnapshot)
    vi.stubGlobal('fetch', fetch)
    openLanding('/')

    expect(document.getElementById('landing-intro-title')).not.toBeNull()
    expect(screen.getByRole('status', { name: 'Loading community updates' })).toBeDefined()
    expect(screen.getByRole('status', { name: 'Loading upcoming event' })).toBeDefined()
    expect(screen.getByRole('status', { name: 'Loading past events' })).toBeDefined()
    expect(screen.getByRole('status', { name: 'Loading articles' })).toBeDefined()

    resolveSnapshot?.(Response.json(snapshot))
    expect(await screen.findByText('Snapshot event')).toBeDefined()
  })

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
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([snapshotUrl])
  })

  it('does not repeat a successful backend fallback while retrying R2', async () => {
    const fallbackSnapshot = {
      ...snapshot,
      articles: [{ ...snapshot.articles[0], title: 'Backend fallback article' }],
      partners: [
        { id: '4190996e-8a68-4178-8a29-97f380734ee3', name: 'CertiK', image: photo },
        { id: '3e03ef6c-9fec-44a7-a944-ec92afaa6512', name: 'Bitskwela', image: photo },
      ],
    }
    const fetch = vi.fn(async (url: string) => {
      if (url === snapshotUrl) {
        return new Response('unavailable', { status: 503 })
      }
      if (url === fallbackUrl) return Response.json(fallbackSnapshot)
      if (url === 'http://127.0.0.1:8000/events?upcoming=true&limit=1') return new Response('unavailable', { status: 503 })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetch)
    const timerSpy = vi.spyOn(globalThis, 'setTimeout')
    openLanding('/')

    expect(await screen.findByText('Backend fallback article')).toBeDefined()
    expect(screen.getByRole('img', { name: 'Bitskwela logo' })).toBeDefined()
    expect(timerSpy.mock.calls.map(([, delay]) => delay)).toContain(5000)
    expect(screen.queryByText('Community updates are temporarily unavailable.')).toBeNull()

    await new Promise((resolve) => setTimeout(resolve, 5200))
    expect(fetch.mock.calls.filter(([url]) => url === fallbackUrl)).toHaveLength(1)
    expect(fetch.mock.calls.filter(([url]) => url === snapshotUrl)).toHaveLength(2)
    expect(screen.getByText('Backend fallback article')).toBeDefined()
  }, 10000)

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

  it('shows local partner logos and keeps data sections on skeletons when both sources fail', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url === snapshotUrl) return new Response('unavailable', { status: 503 })
      if (url === fallbackUrl) return new Response('unavailable', { status: 503 })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetch)
    openLanding('/')

    expect(await screen.findByRole('img', { name: 'Bitskwela logo' })).toBeDefined()
    expect(screen.getByRole('status', { name: 'Loading upcoming event' })).toBeDefined()
    expect(screen.getByRole('status', { name: 'Loading past events' })).toBeDefined()
    expect(screen.getByRole('status', { name: 'Loading articles' })).toBeDefined()
    expect(screen.queryByText('Community updates are temporarily unavailable.')).toBeNull()
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
