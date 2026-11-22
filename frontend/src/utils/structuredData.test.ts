import { describe, expect, it } from 'vitest'

import type { BlogSummary } from '../types/blog'
import type { ContributorResponse } from '../types/contributor'
import type { EventResponse } from '../types/event'
import { blogPosting, event, faqPage, organization, profilePage, serializeJsonLd } from './structuredData'

const blog = {
  id: 'b1',
  title: 'Understanding Web3',
  slug: 'understanding-web3',
  excerpt: 'A primer.',
  published: true,
  published_at: '2026-11-10T09:00:00+08:00',
  created_at: '2026-11-01T09:00:00+08:00',
  updated_at: '2026-11-20T09:00:00+08:00',
  creator: { id: 'u1', display_name: 'Arielle' },
  cover_image_key: 'blogs/cover.webp',
  cover_image_url: '/r2/blogs/cover.webp',
} as BlogSummary

const rsvp = {
  id: 'e1',
  title: 'DeFi Meetup',
  description: '<p>Talks</p>',
  location: 'Ateneo de Davao University',
  registration_url: 'https://lu.ma/example',
  start_datetime: '2026-12-05T18:00:00+08:00',
  end_datetime: null,
  published: true,
  created_at: '2026-11-01T00:00:00+08:00',
  updated_at: '2026-11-01T00:00:00+08:00',
  creator: null,
  banner_image_url: null,
} as EventResponse

describe('structured data', () => {
  it('describes the organization with its social profiles', () => {
    const org = organization()
    expect(org['@type']).toBe('Organization')
    expect(org.sameAs).toContain('https://x.com/DavaoDefi')
  })

  it('builds a BlogPosting with absolute URLs and the author', () => {
    const data = blogPosting(blog)
    expect(data.headline).toBe('Understanding Web3')
    expect(data.image).toEqual(['https://davaodeficommunity.com/r2/blogs/cover.webp'])
    expect(data.author).toEqual({ '@type': 'Person', name: 'Arielle', url: undefined })
    const linked = blogPosting({ ...blog, creator: { id: 'u1', display_name: 'Arielle', public_slug: 'arielle' } })
    expect((linked.author as Record<string, unknown>).url).toBe('https://davaodeficommunity.com/contributors/arielle')
    expect(data.url).toBe('https://davaodeficommunity.com/blog/understanding-web3')
  })

  it('builds an Event and leaves out fields the API does not have', () => {
    const json = JSON.parse(serializeJsonLd([event(rsvp, 'Talks')]))
    expect(json['@context']).toBe('https://schema.org')
    expect(json.startDate).toBe('2026-12-05T18:00:00+08:00')
    expect(json.location).toEqual({ '@type': 'Place', name: 'Ateneo de Davao University', address: 'Ateneo de Davao University' })
    expect('endDate' in json).toBe(false)
    expect('image' in json).toBe(false)
    expect('offers' in json).toBe(false)
  })

  it('lists only http(s) social links on a profile', () => {
    const contributor = {
      display_name: 'Kai', public_slug: 'kai', alias: null, bio: null, profile_photo_key: null,
      profile_photo_url: null, positions: [], contributions: [],
      social_links: { x: 'https://x.com/kai', other: 'javascript:alert(1)' },
    } as unknown as ContributorResponse
    const person = profilePage(contributor).mainEntity as Record<string, unknown>
    expect(person.sameAs).toEqual(['https://x.com/kai'])
  })

  it('wraps several items in a graph and maps FAQs to questions', () => {
    const json = JSON.parse(serializeJsonLd([organization(), faqPage([{ question: 'Q?', answer: 'A.' }])]))
    expect(json['@graph']).toHaveLength(2)
    expect(json['@graph'][1].mainEntity[0]).toEqual({
      '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' },
    })
  })

  it('escapes "<" so API text cannot close the script element', () => {
    const output = serializeJsonLd([blogPosting({ ...blog, title: '</script><script>alert(1)</script>' })])
    expect(output).not.toContain('<')
    expect(JSON.parse(output).headline).toBe('</script><script>alert(1)</script>')
  })
})
