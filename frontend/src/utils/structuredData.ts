/**
 * schema.org structured data (JSON-LD) for the public pages.
 *
 * Pure builders: each takes what the API returned and gives back a plain
 * object. Fields the API does not have are left out rather than guessed - a
 * wrong price or address in a search result is worse than none.
 */

import type { BlogSummary } from '../types/blog'
import type { ContributorResponse } from '../types/contributor'
import type { EventResponse } from '../types/event'
import { absoluteUrl, DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, toMetaDescription } from './pageMeta'
import { rsvpPath } from './publicPaths'

type JsonLdObject = Record<string, unknown>

const ORGANIZATION_ID = `${SITE_URL}/#organization`
const WEBSITE_ID = `${SITE_URL}/#website`

/** Profiles that represent the organization itself (invite links are not profiles). */
export const SOCIAL_PROFILES = [
  'https://www.facebook.com/davaodeficommunity',
  'https://x.com/DavaoDefi',
]

const organizationRef = { '@id': ORGANIZATION_ID }

export function organization(): JsonLdObject {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/icon-512.png`,
    description: DEFAULT_DESCRIPTION,
    sameAs: SOCIAL_PROFILES,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Davao City',
      addressCountry: 'PH',
    },
  }
}

export function website(): JsonLdObject {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    publisher: organizationRef,
  }
}

export function faqPage(faqs: { question: string; answer: string }[]): JsonLdObject {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
}

export function blogPosting(blog: BlogSummary): JsonLdObject {
  const url = absoluteUrl(`/blog/${blog.slug}`)
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: blog.title,
    description: blog.excerpt ?? undefined,
    image: blog.cover_image_url ? [absoluteUrl(blog.cover_image_url)] : undefined,
    datePublished: blog.published_at ?? undefined,
    dateModified: blog.updated_at,
    author: blog.creator
      ? {
          '@type': 'Person',
          name: blog.creator.display_name,
          url: blog.creator.public_slug ? absoluteUrl(`/contributors/${blog.creator.public_slug}`) : undefined,
        }
      : organizationRef,
    publisher: organizationRef,
    mainEntityOfPage: url,
    url,
  }
}

/** An RSVP page: a scheduled, in-person community event. */
export function event(item: EventResponse, plainDescription: string): JsonLdObject {
  const url = absoluteUrl(rsvpPath(item))
  return {
    '@type': 'Event',
    '@id': `${url}#event`,
    name: item.title,
    description: toMetaDescription(plainDescription) ?? undefined,
    startDate: item.start_datetime,
    endDate: item.end_datetime ?? undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: item.location
      ? { '@type': 'Place', name: item.location, address: item.location }
      : undefined,
    image: item.banner_image_url ? [absoluteUrl(item.banner_image_url)] : undefined,
    organizer: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
    url,
  }
}

export function profilePage(contributor: ContributorResponse): JsonLdObject {
  const url = absoluteUrl(`/contributors/${contributor.public_slug}`)
  const sameAs = Object.values(contributor.social_links ?? {}).filter((link) => /^https?:\/\//.test(link))
  return {
    '@type': 'ProfilePage',
    url,
    mainEntity: {
      '@type': 'Person',
      name: contributor.display_name,
      alternateName: contributor.alias ?? undefined,
      description: contributor.bio ?? undefined,
      image: contributor.profile_photo_url ? absoluteUrl(contributor.profile_photo_url) : undefined,
      sameAs: sameAs.length ? sameAs : undefined,
      memberOf: organizationRef,
    },
  }
}

/**
 * Serialize for an inline <script type="application/ld+json">.
 *
 * Values come from the API (titles, bios), so "<" is escaped: otherwise a title
 * containing "</script>" would end the script element early. Undefined fields
 * are dropped by JSON.stringify.
 */
export function serializeJsonLd(items: JsonLdObject[]): string {
  const document = items.length === 1
    ? { '@context': 'https://schema.org', ...items[0] }
    : { '@context': 'https://schema.org', '@graph': items }
  return JSON.stringify(document).replace(/</g, '\\u003c')
}
