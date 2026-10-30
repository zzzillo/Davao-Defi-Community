import type { EventResponse, EventCreatePayload } from '../types/event'
import type { BlogResponse, BlogSummary, BlogCreatePayload } from '../types/blog'
import type { PartnerResponse, PartnerCreatePayload } from '../types/partner'
import type { PostResponse, PostCreatePayload } from '../types/post'
import type { ActivityLogResponse } from '../types/activityLog'

const STORE_KEY = 'ddc-demo-data-v1'
const now = '2026-10-29T09:00:00+08:00'
const sarah = { id: 'demo-sarah-jenkins', display_name: 'Sarah Jenkins' }

type DemoData = {
  events: EventResponse[]
  blogs: BlogResponse[]
  partners: PartnerResponse[]
  posts: PostResponse[]
  activity: ActivityLogResponse[]
}

function seed(): DemoData {
  return {
    events: [
      { id: 'event-1', title: 'Davao DeFi Summit 2026', description: 'A full day of talks, workshops, and networking for the builders shaping decentralized finance in Mindanao.', location: 'SMX Convention Center, Davao', start_datetime: '2026-11-14T09:00:00+08:00', end_datetime: '2026-11-14T18:00:00+08:00', published: true, created_at: '2026-09-10T10:00:00+08:00', updated_at: now, creator: sarah, banner_image_url: null },
      { id: 'event-2', title: 'Web3 Builders Meetup', description: 'An informal evening of demos, peer feedback, and community updates.', location: 'The Company, Davao City', start_datetime: '2026-11-05T18:30:00+08:00', end_datetime: '2026-11-05T21:00:00+08:00', published: true, created_at: '2026-10-01T11:00:00+08:00', updated_at: now, creator: { id: 'demo-amanda', display_name: 'Amanda Lee' }, banner_image_url: null },
      { id: 'event-3', title: 'Smart Contract Security Workshop', description: 'Hands-on introduction to common Solidity vulnerabilities and practical testing tools.', location: 'University of Southeastern Philippines', start_datetime: '2026-11-21T13:00:00+08:00', end_datetime: '2026-11-21T17:00:00+08:00', published: true, created_at: '2026-10-03T12:00:00+08:00', updated_at: now, creator: sarah, banner_image_url: null },
      { id: 'event-4', title: 'Community Governance Roundtable', description: 'A working session for contributors to review proposals and plan the next quarter.', location: 'Online · Discord', start_datetime: '2026-12-03T19:00:00+08:00', end_datetime: '2026-12-03T20:30:00+08:00', published: false, created_at: '2026-10-09T12:00:00+08:00', updated_at: now, creator: sarah, banner_image_url: null },
      { id: 'event-5', title: 'Blockchain 101: Wallets and Safety', description: 'A friendly introduction to wallets, self custody, and staying safe onchain.', location: 'Davao City Library', start_datetime: '2026-10-10T10:00:00+08:00', end_datetime: '2026-10-10T12:00:00+08:00', published: true, created_at: '2026-09-01T09:00:00+08:00', updated_at: now, creator: sarah, banner_image_url: null },
      { id: 'event-6', title: 'Mindanao DAO Retreat', description: 'Core contributors align on community priorities and make space to recharge.', location: 'Samal Island', start_datetime: '2027-01-17T10:00:00+08:00', end_datetime: '2027-01-18T16:00:00+08:00', published: false, created_at: '2026-10-12T15:00:00+08:00', updated_at: now, creator: sarah, banner_image_url: null },
    ],
    blogs: [
      { id: 'blog-1', title: 'Building a Stronger Web3 Community in Mindanao', slug: 'stronger-web3-community-mindanao', excerpt: 'Local builders are turning curiosity into a durable ecosystem through education, open collaboration, and shared ownership.', content: '<p>Web3 communities grow when people can learn together, ship useful tools, and see a path from first event to meaningful contribution.</p><h2>Start with people</h2><p>Meetups and workshops give new builders a welcoming place to ask questions and find collaborators.</p>', published: true, published_at: '2026-10-16T10:00:00+08:00', created_at: '2026-10-08T10:00:00+08:00', updated_at: now, creator: sarah, cover_image_key: null, cover_image_url: null },
      { id: 'blog-2', title: 'A Practical Guide to Smart Contract Audits', slug: 'practical-guide-smart-contract-audits', excerpt: 'What teams can prepare before an audit, and how to turn findings into better engineering habits.', content: '<p>A good audit starts well before review day. Clear scope, reproducible tests, and documented assumptions help reviewers focus on the code that matters.</p>', published: true, published_at: '2026-10-12T10:00:00+08:00', created_at: '2026-10-04T10:00:00+08:00', updated_at: now, creator: { id: 'demo-david', display_name: 'David Chen' }, cover_image_key: null, cover_image_url: null },
      { id: 'blog-3', title: 'Community Recap: Builders Meetup', slug: 'builders-meetup-recap', excerpt: 'Highlights from an evening of product demos, thoughtful questions, and new collaborations.', content: '<p>Thanks to everyone who joined our latest builders meetup. The demos showed the range of talent growing across Davao.</p>', published: true, published_at: '2026-10-06T10:00:00+08:00', created_at: '2026-10-02T10:00:00+08:00', updated_at: now, creator: sarah, cover_image_key: null, cover_image_url: null },
      { id: 'blog-4', title: 'Stablecoins and Everyday Payments', slug: 'stablecoins-everyday-payments', excerpt: 'A draft explainer on where stablecoins may help and what users should understand first.', content: '<p>Stablecoins can make digital transfers easier to reason about, but users still need to understand custody, fees, and issuer risk.</p>', published: false, published_at: null, created_at: '2026-10-18T10:00:00+08:00', updated_at: now, creator: sarah, cover_image_key: null, cover_image_url: null },
    ],
    partners: [
      { id: 'partner-1', name: 'Ethereum Philippines', logo_key: null, logo_url: null, created_at: '2026-08-10T10:00:00+08:00', updated_at: now },
      { id: 'partner-2', name: 'University of Southeastern Philippines', logo_key: null, logo_url: null, created_at: '2026-08-14T10:00:00+08:00', updated_at: now },
      { id: 'partner-3', name: 'Solana Superteam Philippines', logo_key: null, logo_url: null, created_at: '2026-08-18T10:00:00+08:00', updated_at: now },
      { id: 'partner-4', name: 'Devcon', logo_key: null, logo_url: null, created_at: '2026-08-22T10:00:00+08:00', updated_at: now },
      { id: 'partner-5', name: 'Davao City', logo_key: null, logo_url: null, created_at: '2026-08-28T10:00:00+08:00', updated_at: now },
    ],
    posts: [
      { id: 'post-1', title: 'Thank you, Davao builders!', description: 'A few moments from our latest community meetup. Great conversations, new ideas, and lots of momentum for what comes next.', location: 'Davao City', post_date: '2026-10-24', published: true, created_at: '2026-10-24T19:00:00+08:00', updated_at: now, creator: sarah, event: null, images: [] },
      { id: 'post-2', title: 'Workshop registration is open', description: 'Join us for a hands-on session on smart contract security. All experience levels are welcome.', location: null, post_date: '2026-10-20', published: true, created_at: '2026-10-20T12:00:00+08:00', updated_at: now, creator: { id: 'demo-amanda', display_name: 'Amanda Lee' }, event: null, images: [] },
      { id: 'post-3', title: 'Summit speaker announcement', description: 'We are preparing a great lineup of builders and researchers. More details coming soon.', location: null, post_date: '2026-10-17', published: false, created_at: '2026-10-17T12:00:00+08:00', updated_at: now, creator: sarah, event: null, images: [] },
    ],
    activity: [
      { id: 'activity-1', action: 'published', resource: 'event', resource_id: 'event-1', details: { title: 'Davao DeFi Summit 2026' }, created_at: '2026-10-28T15:40:00+08:00', user: sarah },
      { id: 'activity-2', action: 'updated', resource: 'blog', resource_id: 'blog-1', details: { title: 'Building a Stronger Web3 Community in Mindanao' }, created_at: '2026-10-27T13:15:00+08:00', user: sarah },
      { id: 'activity-3', action: 'created', resource: 'partner', resource_id: 'partner-5', details: { name: 'Davao City' }, created_at: '2026-10-26T10:05:00+08:00', user: { id: 'demo-amanda', display_name: 'Amanda Lee' } },
      { id: 'activity-4', action: 'created', resource: 'post', resource_id: 'post-1', details: { title: 'Thank you, Davao builders!' }, created_at: '2026-10-24T19:00:00+08:00', user: sarah },
      { id: 'activity-5', action: 'updated', resource: 'event', resource_id: 'event-3', details: { title: 'Smart Contract Security Workshop' }, created_at: '2026-10-23T09:20:00+08:00', user: { id: 'demo-david', display_name: 'David Chen' } },
      { id: 'activity-6', action: 'published', resource: 'blog', resource_id: 'blog-2', details: { title: 'A Practical Guide to Smart Contract Audits' }, created_at: '2026-10-22T16:30:00+08:00', user: sarah },
    ],
  }
}

function readData(): DemoData {
  try {
    const stored = localStorage.getItem(STORE_KEY)
    return stored ? JSON.parse(stored) as DemoData : seed()
  } catch {
    return seed()
  }
}
let data = readData()
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)) } catch { /* private browsing */ }
}

type Options = { method?: string; body?: unknown; token?: string | null }
function page<T>(items: T[], params: URLSearchParams) {
  const limit = Math.max(1, Number(params.get('limit') ?? 20))
  const offset = Math.max(0, Number(params.get('offset') ?? 0))
  const slice = items.slice(offset, offset + limit)
  return { items: slice, total: items.length, limit, offset, page: Math.floor(offset / limit) + 1, has_next: offset + limit < items.length }
}
function filtered<T extends { id: string }>(items: T[], params: URLSearchParams, fields: string[]) {
  const search = params.get('search')?.trim().toLowerCase()
  return search ? items.filter((item) => fields.some((field) => String((item as Record<string, unknown>)[field] ?? '').toLowerCase().includes(search))) : items
}
function log(resource: ActivityLogResponse['resource'], action: ActivityLogResponse['action'], id: string, details: Record<string, unknown>) {
  data.activity.unshift({ id: `activity-${Date.now()}`, action, resource, resource_id: id, details, created_at: new Date().toISOString(), user: sarah })
}
function newId(type: string) { return `${type}-${Date.now()}` }
function notFound(): never { throw new Error('Sample record not found') }

/** In-browser API substitute for the admin demo. Changes persist in localStorage. */
export async function demoApiRequest<T>(path: string, options: Options = {}): Promise<T> {
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  const method = options.method ?? 'GET'
  const parts = pathname.split('/').filter(Boolean)
  const collection = parts[0]
  const idOrSlug = parts[1]
  const token = options.token
  const body = (options.body ?? {}) as Record<string, unknown>

  if (collection === 'activity-logs' && method === 'GET') {
    const entries = data.activity.filter((entry) =>
      (!params.get('resource') || entry.resource === params.get('resource')) &&
      (!params.get('action') || entry.action === params.get('action')) &&
      (!params.get('user_id') || entry.user?.id === params.get('user_id')))
    return page(entries, params) as T
  }

  const records = collection === 'events' ? data.events
    : collection === 'blogs' ? data.blogs
      : collection === 'partners' ? data.partners
        : collection === 'posts' ? data.posts : null
  if (!records) throw new Error(`No demo data for ${pathname}`)

  const isPrivate = (row: EventResponse | BlogResponse | PostResponse) => !row.published
  const visible = <R extends { published?: boolean }>(rows: R[]) =>
    params.get('include_drafts') === 'true' && token ? rows : rows.filter((row) => row.published !== false)

  if (method === 'GET' && !idOrSlug) {
    let list: Array<EventResponse | BlogResponse | PartnerResponse | PostResponse> = collection === 'events'
      ? filtered(visible(data.events), params, ['title', 'description', 'location'])
      : collection === 'blogs'
        ? filtered(visible(data.blogs), params, ['title', 'excerpt'])
        : collection === 'posts'
          ? filtered(visible(data.posts), params, ['title', 'description', 'location'])
          : filtered(data.partners, params, ['name'])
    if (collection === 'events' && params.get('upcoming') !== null) {
      const upcoming = params.get('upcoming') === 'true'
      const at = Date.now()
      list = (list as EventResponse[]).filter((event) => (new Date(event.start_datetime).getTime() >= at) === upcoming)
    }
    if (params.get('creator_id')) list = list.filter((row) => (row as EventResponse | BlogResponse | PostResponse).creator?.id === params.get('creator_id'))
    if (collection === 'posts' && params.get('event_id')) list = list.filter((row) => (row as PostResponse).event?.id === params.get('event_id'))
    if (collection === 'blogs') list = [...list].sort((a, b) => (b as BlogSummary).created_at.localeCompare((a as BlogSummary).created_at))
    if (collection === 'partners') list = [...list].sort((a, b) => (a as PartnerResponse).name.localeCompare((b as PartnerResponse).name))
    return page(list, params) as T
  }

  if (method === 'GET' && collection === 'blogs' && idOrSlug === 'slug') {
    const blog = data.blogs.find((entry) => entry.slug === parts[2] && (entry.published || token))
    return (blog ?? notFound()) as T
  }
  if (method === 'GET' && idOrSlug) {
    const row = collection === 'blogs' ? data.blogs.find((entry) => entry.id === idOrSlug)
      : records.find((entry) => entry.id === idOrSlug)
    if (!row || (isPrivate(row as EventResponse | BlogResponse | PostResponse) && !token)) return notFound()
    return row as T
  }

  if (!token) throw new Error('Please sign in to continue')
  const timestamp = new Date().toISOString()
  if (method === 'POST') {
    let row: EventResponse | BlogResponse | PartnerResponse | PostResponse
    if (collection === 'events') {
      const payload = body as unknown as EventCreatePayload
      row = { id: newId('event'), title: payload.title, description: payload.description ?? null, location: payload.location ?? null, start_datetime: payload.start_datetime, end_datetime: payload.end_datetime ?? null, published: payload.published ?? false, created_at: timestamp, updated_at: timestamp, creator: sarah, banner_image_url: null }
      data.events.unshift(row as EventResponse); log('event', 'created', row.id, { title: row.title })
    } else if (collection === 'blogs') {
      const payload = body as unknown as BlogCreatePayload
      const slug = payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      row = { id: newId('blog'), title: payload.title, slug, excerpt: payload.excerpt ?? null, content: payload.content ?? null, published: payload.published ?? false, published_at: payload.published ? payload.published_at ?? timestamp : null, created_at: timestamp, updated_at: timestamp, creator: sarah, cover_image_key: payload.cover_image_key ?? null, cover_image_url: null }
      data.blogs.unshift(row as BlogResponse); log('blog', 'created', row.id, { title: row.title })
    } else if (collection === 'partners') {
      const payload = body as unknown as PartnerCreatePayload
      row = { id: newId('partner'), name: payload.name, logo_key: payload.logo_key ?? null, logo_url: null, created_at: timestamp, updated_at: timestamp }
      data.partners.unshift(row as PartnerResponse); log('partner', 'created', row.id, { name: row.name })
    } else {
      const payload = body as unknown as PostCreatePayload
      const event = data.events.find((entry) => entry.id === payload.event_id)
      row = { id: newId('post'), title: payload.title ?? null, description: payload.description ?? null, location: payload.location ?? null, post_date: payload.post_date, published: payload.published ?? false, created_at: timestamp, updated_at: timestamp, creator: sarah, event: event ? { id: event.id, title: event.title, start_datetime: event.start_datetime, published: event.published } : null, images: (payload.images ?? []).map((image, index) => ({ id: `${Date.now()}-${index}`, display_order: index, image_key: image.image_key, image_url: null })) }
      data.posts.unshift(row as PostResponse); log('post', 'created', row.id, { title: row.title ?? 'Community post' })
    }
    save(); return row as T
  }
  if (method === 'PATCH' && idOrSlug) {
    const row = records.find((entry) => entry.id === idOrSlug)
    if (!row) return notFound()
    Object.assign(row, body, { updated_at: timestamp })
    const resource = collection === 'events' ? 'event' : collection === 'blogs' ? 'blog' : collection === 'partners' ? 'partner' : 'post'
    log(resource, 'updated', row.id, { title: (row as EventResponse | BlogResponse | PostResponse).title ?? (row as PartnerResponse).name })
    save(); return row as T
  }
  if (method === 'DELETE' && idOrSlug) {
    const index = records.findIndex((entry) => entry.id === idOrSlug)
    if (index < 0) return notFound()
    const [removed] = records.splice(index, 1)
    const resource = collection === 'events' ? 'event' : collection === 'blogs' ? 'blog' : collection === 'partners' ? 'partner' : 'post'
    log(resource, 'deleted', removed.id, { title: (removed as EventResponse | BlogResponse | PostResponse).title ?? (removed as PartnerResponse).name })
    save(); return undefined as T
  }
  throw new Error(`Unsupported demo request: ${method} ${pathname}`)
}

export function resetDemoData() {
  data = seed()
  save()
}
