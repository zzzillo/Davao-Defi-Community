import { apiRequest } from './api'
import { useLocalPartnerLogos } from '../data/landingPartnerFallback'

export type SnapshotImage = {
  src: string
  variants: { url: string; width: number }[]
}

type Card = { id: string; image: SnapshotImage | null }
type TitledCard = Card & { title: string }
type EventCard = TitledCard & {
  kind: 'upcoming' | 'latest'
  description: string
  location: string | null
  start_datetime: string
  end_datetime: string | null
}
type RecapCard = TitledCard & { description: string; location: string | null; post_date: string }
type ArticleCard = TitledCard & {
  slug: string
  excerpt: string
  author: string | null
  published_at: string | null
  updated_at: string | null
}

export type LandingSnapshot = {
  version: 1
  partners: (Card & { name: string })[]
  event: EventCard | null
  recaps: RecapCard[]
  articles: ArticleCard[]
  stats: { events: number; contributors: number; partners: number }
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !/\s/.test(value)
  } catch {
    return false
  }
}

function isImageUrl(value: unknown): value is string {
  return isHttpsUrl(value) || (import.meta.env.DEV && typeof value === 'string' && value.startsWith('/r2/'))
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const isNullableString = (value: unknown) => value === null || typeof value === 'string'
const isDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))

function isImage(value: unknown): boolean {
  return value === null || (
    isObject(value) && isImageUrl(value.src) && Array.isArray(value.variants) && value.variants.length <= 2
    && value.variants.every((variant: unknown) => (
      isObject(variant) && isImageUrl(variant.url) && isCount(variant.width) && variant.width > 0
    ))
  )
}

function isCard(value: unknown): value is JsonObject {
  return isObject(value) && typeof value.id === 'string' && value.id.length > 0 && isImage(value.image)
}

function isTitledCard(value: unknown): value is JsonObject {
  return isCard(value) && typeof value.title === 'string'
}

function isSnapshot(value: unknown): value is LandingSnapshot {
  if (!isObject(value) || value.version !== 1) return false
  const { partners, event, recaps, articles, stats } = value
  return (
    Array.isArray(partners) && partners.length <= 100 && partners.every((partner) => isCard(partner) && typeof partner.name === 'string')
    && (event === null || (
      isTitledCard(event) && (event.kind === 'upcoming' || event.kind === 'latest')
      && typeof event.description === 'string' && isNullableString(event.location)
      && isDate(event.start_datetime) && (event.end_datetime === null || isDate(event.end_datetime))
    ))
    && Array.isArray(recaps) && recaps.length <= 4 && recaps.every((recap) => (
      isTitledCard(recap) && typeof recap.description === 'string' && isNullableString(recap.location)
      && typeof recap.post_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(recap.post_date) && isDate(recap.post_date)
    ))
    && Array.isArray(articles) && articles.length <= 3 && articles.every((article) => (
      isTitledCard(article) && typeof article.slug === 'string' && article.slug.length > 0
      && typeof article.excerpt === 'string' && isNullableString(article.author)
      && ((isDate(article.published_at) && article.updated_at === null) || (article.published_at === null && isDate(article.updated_at)))
    ))
    && isObject(stats) && isCount(stats.events) && isCount(stats.contributors) && isCount(stats.partners)
  )
}

const inFlight = new Map<string, Promise<LandingSnapshot>>()
const inFlightWithFallback = new Map<string, Promise<{ snapshot: LandingSnapshot; source: 'snapshot' | 'backend' }>>()

export function loadLandingSnapshot(): Promise<LandingSnapshot> {
  const url = import.meta.env.VITE_LANDING_SNAPSHOT_URL?.trim()
  if (!url) return Promise.reject(new Error('Landing snapshot URL is missing'))

  const pending = inFlight.get(url)
  if (pending) return pending

  const request = fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(8000) })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Landing snapshot HTTP ${response.status}`)
      const value: unknown = await response.json()
      if (!isSnapshot(value)) throw new Error('Landing snapshot has an invalid format')
      return value
    })
    .finally(() => inFlight.delete(url))

  inFlight.set(url, request)
  return request
}

/** Try the cached snapshot first, then query PostgreSQL directly if it fails. */
export function loadLandingData(): Promise<{ snapshot: LandingSnapshot; source: 'snapshot' | 'backend' }> {
  const snapshotUrl = import.meta.env.VITE_LANDING_SNAPSHOT_URL?.trim() || '<missing-snapshot-url>'
  const pending = inFlightWithFallback.get(snapshotUrl)
  if (pending) return pending

  const request = loadLandingSnapshot()
    .then((snapshot) => ({ snapshot, source: 'snapshot' as const }))
    .catch(async () => {
      const value = await apiRequest<unknown>('/landing/v1/fallback.json', {
        signal: AbortSignal.timeout(8000),
      })
      if (!isSnapshot(value)) throw new Error('Backend landing fallback has an invalid format')
      return { snapshot: useLocalPartnerLogos(value), source: 'backend' as const }
    })
    .finally(() => inFlightWithFallback.delete(snapshotUrl))

  inFlightWithFallback.set(snapshotUrl, request)
  return request
}
