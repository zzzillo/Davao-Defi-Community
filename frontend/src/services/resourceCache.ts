export const RESOURCE_NAMES = ['events', 'posts', 'blogs', 'partners', 'users', 'dashboard', 'activity'] as const
export const MAX_RESOURCE_CACHE_ENTRIES = 100

export type ResourceName = typeof RESOURCE_NAMES[number]

type CacheEntry = {
  resource: ResourceName
  scope: string
  paramsKey: string
  data: unknown
  stale: boolean
  updatedAt: number
}

type InvalidationListener = (resource: ResourceName, scope?: string) => void

const cache = new Map<string, CacheEntry>()
const invalidationListeners = new Set<InvalidationListener>()

// Route changes must not turn a warm list into a blocking cold load. Entries
// live only in this browser process, remain bounded by the LRU limit, and
// private entries are cleared when the authenticated management scope changes.

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    )
  }
  return value
}

function paramsKey(params: unknown): string {
  return JSON.stringify(stableValue(params))
}

function entryKey(resource: ResourceName, params: unknown, scope: string): string {
  return JSON.stringify([resource, scope, paramsKey(params)])
}

function evictLeastRecentlyUsedEntries(): void {
  while (cache.size > MAX_RESOURCE_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) return
    cache.delete(oldestKey)
  }
}

export function managementResourceScope(
  user: { id: string; clerk_user_id: string; role: string; status: string } | null,
  isSignedIn: boolean,
): string {
  if (!isSignedIn || !user) return 'management:unresolved'
  return `management:${user.id}:${user.clerk_user_id}:${user.role}:${user.status}`
}

export function readResourceCache<T>(
  resource: ResourceName,
  params: unknown,
  scope: string,
): { data: T; stale: boolean; updatedAt: number } | null {
  const key = entryKey(resource, params, scope)
  const entry = cache.get(key)
  if (!entry) return null
  // Map insertion order doubles as a small LRU list. Reading refreshes recency
  // without changing when the response was fetched.
  cache.delete(key)
  cache.set(key, entry)
  return { data: entry.data as T, stale: entry.stale, updatedAt: entry.updatedAt }
}

/**
 * Find the newest cached record with this id, whether it was cached as a
 * detail response or as one item in a paginated list. Management records stay
 * inside their existing auth scope, so a public list can never seed an admin
 * editor (or vice versa).
 */
export function readCachedResourceItem<T>(
  resource: ResourceName,
  id: string,
  scope: string,
): { data: T; stale: boolean; updatedAt: number } | null {
  let newest: CacheEntry | null = null
  for (const entry of cache.values()) {
    if (entry.resource !== resource || entry.scope !== scope) continue

    const data = entry.data as { id?: unknown; items?: unknown }
    const matchesDetail = data?.id === id
    const matchesList = Array.isArray(data?.items)
      && data.items.some((item) => Boolean(item && typeof item === 'object' && 'id' in item && item.id === id))
    if ((matchesDetail || matchesList) && (!newest || entry.updatedAt >= newest.updatedAt)) {
      newest = entry
    }
  }

  if (!newest) return null
  const data = newest.data as { id?: unknown; items?: unknown }
  const item = data?.id === id
    ? newest.data
    : (data.items as Array<{ id?: unknown }>).find((candidate) => candidate?.id === id)

  return item === undefined
    ? null
    : { data: item as T, stale: newest.stale, updatedAt: newest.updatedAt }
}

export function setResourceCache<T>(
  resource: ResourceName,
  params: unknown,
  data: T,
  scope: string,
): void {
  const now = Date.now()
  const key = entryKey(resource, params, scope)
  cache.delete(key)
  cache.set(key, {
    resource,
    scope,
    paramsKey: paramsKey(params),
    data,
    stale: false,
    updatedAt: now,
  })
  evictLeastRecentlyUsedEntries()
}

export function removeResourceCache(resource: ResourceName, params: unknown, scope: string): void {
  cache.delete(entryKey(resource, params, scope))
}

export function invalidateResource(resource: ResourceName, scope?: string): void {
  for (const entry of cache.values()) {
    if (entry.resource === resource && (scope === undefined || entry.scope === scope)) {
      entry.stale = true
    }
  }
  for (const listener of invalidationListeners) listener(resource, scope)
}

export function invalidateResources(resources: readonly ResourceName[], scope?: string): void {
  for (const resource of resources) invalidateResource(resource, scope)
}

export function subscribeResourceInvalidations(listener: InvalidationListener): () => void {
  invalidationListeners.add(listener)
  return () => invalidationListeners.delete(listener)
}

export function clearManagementResourceCache(): void {
  for (const [key, entry] of cache) {
    if (entry.scope.startsWith('management:')) cache.delete(key)
  }
}

export function clearAllResourceCache(): void {
  cache.clear()
}
