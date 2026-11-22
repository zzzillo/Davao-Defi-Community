import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import EventDetails from './EventDetails'

vi.mock('../../hooks/useEvents', () => ({
  useEvent: (id: string) => ({
    event: {
      id, title: 'DeFi Meetup', description: '<p>Talks</p>', location: 'Davao City', registration_url: null,
      start_datetime: '2026-12-05T18:00:00+08:00', end_datetime: null, published: true,
      created_at: '2026-11-01T00:00:00+08:00', updated_at: '2026-11-01T00:00:00+08:00', creator: null, banner_image_url: null,
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}))

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/rsvp/:id/:slug?" element={<><EventDetails /><CurrentPath /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RSVP page address', () => {
  it('moves a bare or outdated address to the current title slug', async () => {
    for (const path of ['/rsvp/e1', '/rsvp/e1/old-title']) {
      renderAt(path)
      expect((await screen.findByRole('heading', { level: 1, name: 'DeFi Meetup' })).textContent).toBe('DeFi Meetup')
      expect(screen.getByTestId('path').textContent).toBe('/rsvp/e1/defi-meetup')
      document.body.innerHTML = ''
    }
  })

  it('stays on the current address', async () => {
    renderAt('/rsvp/e1/defi-meetup')
    await screen.findByRole('heading', { level: 1, name: 'DeFi Meetup' })
    expect(screen.getByTestId('path').textContent).toBe('/rsvp/e1/defi-meetup')
  })
})
