import { describe, expect, it } from 'vitest'

import { eventGalleryPath, rsvpPath } from './publicPaths'

describe('public event paths', () => {
  it('puts the title slug after the id', () => {
    expect(eventGalleryPath({ id: 'p1', title: 'Sundown Avalanche — Night 2!' })).toBe('/events/p1/sundown-avalanche-night-2')
    expect(rsvpPath({ id: 'e1', title: 'DeFi Meetup @ Ateneo' })).toBe('/rsvp/e1/defi-meetup-ateneo')
  })

  it('falls back to the bare id when the title gives no slug', () => {
    expect(eventGalleryPath({ id: 'p1', title: null })).toBe('/events/p1')
    expect(rsvpPath({ id: 'e1', title: '活动' })).toBe('/rsvp/e1')
  })
})
