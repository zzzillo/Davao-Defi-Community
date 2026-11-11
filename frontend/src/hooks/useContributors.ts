import { useCallback, useEffect, useMemo, useState } from 'react'

import type { BlogSummary, BlogListResponse } from '../types/blog'
import type { Page } from '../types/pagination'
import type {
  ContributorBlogListParams,
  ContributorListParams,
} from '../types/contributor'
import { ApiError } from '../services/api'
import {
  readResourceCache,
  setResourceCache,
  subscribeResourceInvalidations,
} from '../services/resourceCache'
import type { ResourceName } from '../services/resourceCache'
import {
  getContributor,
  listContributorBlogs,
  listContributors,
} from '../services/contributorService'

type PublicRequestOptions = { signal?: AbortSignal }
type PublicListFetcher<T, P> = (params: P, options: PublicRequestOptions) => Promise<Page<T>>

function asPublicError(caught: unknown): ApiError {
  if (caught instanceof ApiError) return caught
  return new ApiError(0, 'Could not reach the server. Check your connection.')
}

function usePublicList<T, P>(
  fetcher: PublicListFetcher<T, P>,
  params: P,
  enabled = true,
  identity = '',
  resource: ResourceName = 'users',
) {
  const paramsKey = JSON.stringify(params)
  const cacheParams = useMemo(
    () => ({ identity, params: JSON.parse(paramsKey) as P }),
    [identity, paramsKey],
  )
  const resourceKey = JSON.stringify([resource, identity, paramsKey])
  const [result, setResult] = useState<{
    key: string
    data: Page<T>
  } | null>(null)
  const [activeRequestKey, setActiveRequestKey] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ key: string; error: ApiError } | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const cached = readResourceCache<Page<T>>(resource, cacheParams, 'public')
  const current = result?.key === resourceKey ? result.data : cached?.data ?? null

  useEffect(() => subscribeResourceInvalidations((changed, scope) => {
    if (changed === resource && (scope === undefined || scope === 'public')) {
      setReloadCount((count) => count + 1)
    }
  }), [resource])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const controller = new AbortController()
    let superseded = false

    async function load() {
      setActiveRequestKey(resourceKey)
      setFailure(null)

      try {
        // Public directory routes deliberately receive no session token. An
        // official viewing the public site sees the same published records as
        // an anonymous visitor.
        const data = await fetcher(JSON.parse(paramsKey) as P, { signal: controller.signal })
        if (superseded) return
        setResourceCache(resource, cacheParams, data, 'public')
        setResult({ key: resourceKey, data })
      } catch (caught) {
        if (superseded || controller.signal.aborted) return
        setFailure({ key: resourceKey, error: asPublicError(caught) })
      } finally {
        if (!superseded) setActiveRequestKey((currentKey) => currentKey === resourceKey ? null : currentKey)
      }
    }

    void load()
    return () => {
      superseded = true
      controller.abort()
    }
  }, [enabled, fetcher, paramsKey, resourceKey, reloadCount, resource, cacheParams])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])
  const currentFailure = failure?.key === resourceKey ? failure.error : null

  return {
    items: enabled ? current?.items ?? [] : [],
    total: enabled ? current?.total ?? 0 : 0,
    page: enabled ? current?.page ?? 1 : 1,
    hasNext: enabled && Boolean(current?.has_next),
    loading: enabled && !current && (activeRequestKey === resourceKey || !currentFailure),
    refreshing: enabled && Boolean(current) && activeRequestKey === resourceKey,
    error: enabled ? currentFailure : null,
    reload,
  }
}

function usePublicItem<T>(
  fetcher: (key: string, options: PublicRequestOptions) => Promise<T>,
  key: string | null | undefined,
  resource: ResourceName,
) {
  const [result, setResult] = useState<{ key: string; item: T } | null>(null)
  const [fetchingKey, setFetchingKey] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ key: string; error: ApiError } | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const requestKey = JSON.stringify([resource, key ?? ''])
  const cached = key ? readResourceCache<T>(resource, key, 'public') : null
  const item = result?.key === requestKey ? result.item : cached?.data ?? null

  useEffect(() => subscribeResourceInvalidations((changed, scope) => {
    if (changed === resource && (scope === undefined || scope === 'public')) {
      setReloadCount((count) => count + 1)
    }
  }), [resource])

  useEffect(() => {
    if (!key) {
      return
    }

    const itemKey = key
    const controller = new AbortController()
    let superseded = false

    async function load() {
      setFetchingKey(requestKey)
      setFailure(null)
      try {
        const item = await fetcher(itemKey, { signal: controller.signal })
        if (!superseded) {
          setResourceCache(resource, itemKey, item, 'public')
          setResult({ key: requestKey, item })
        }
      } catch (caught) {
        if (superseded || controller.signal.aborted) return
        setFailure({ key: requestKey, error: asPublicError(caught) })
      } finally {
        if (!superseded) {
          setFetchingKey((currentKey) => currentKey === requestKey ? null : currentKey)
        }
      }
    }

    void load()
    return () => {
      superseded = true
      controller.abort()
    }
  }, [fetcher, key, requestKey, reloadCount, resource])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])
  const currentFailure = failure?.key === requestKey ? failure.error : null

  return {
    item,
    loading: Boolean(key) && !item && (fetchingKey === requestKey || !currentFailure),
    refreshing: Boolean(key) && Boolean(item) && fetchingKey === requestKey,
    error: Boolean(key) ? currentFailure : null,
    reload,
  }
}

export function useContributors(params: ContributorListParams = {}) {
  const { items, ...rest } = usePublicList(listContributors, params, true, '', 'users')
  return { contributors: items, ...rest }
}

export function useContributor(publicSlug: string | null | undefined) {
  return usePublicItem(getContributor, publicSlug, 'users')
}

export function useContributorBlogs(
  publicSlug: string | null | undefined,
  params: ContributorBlogListParams = {},
) {
  const fetcher = useCallback(
    (pageParams: ContributorBlogListParams, options: PublicRequestOptions): Promise<BlogListResponse> =>
      publicSlug
        ? listContributorBlogs(publicSlug, pageParams, options)
        : Promise.resolve({ items: [], total: 0, limit: pageParams.limit ?? 20, offset: pageParams.offset ?? 0, page: 1, has_next: false }),
    [publicSlug],
  )
  const { items, ...rest } = usePublicList<BlogSummary, ContributorBlogListParams>(
    fetcher,
    params,
    Boolean(publicSlug),
    publicSlug ?? '',
    'blogs',
  )
  return { blogs: items, ...rest }
}
