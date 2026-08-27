/**
 * React's view of the blogs API.
 *
 * Thin on purpose. Everything hard - the out-of-order request guard, the
 * effect key, the token handling, the in-flight flags - lives once in
 * useApiResource.ts. What remains here is naming: which service function, and
 * what the returned collection is called.
 *
 * This file is the payoff for having extracted useApiResource during Posts.
 * The version of it that would have existed without that extraction is the
 * 254-line useEvents this project started with.
 *
 * Pages use these and stay free of fetch logic entirely.
 */

import { useCallback } from 'react'

import type { ApiError } from '../services/api'
import {
  createBlog,
  deleteBlog,
  getBlog,
  getBlogBySlug,
  listBlogs,
  updateBlog,
} from '../services/blogService'
import type {
  BlogCreatePayload,
  BlogListParams,
  BlogResponse,
  BlogSummary,
  BlogUpdatePayload,
} from '../types/blog'
import { useApiItem, useApiList, useAuthedAction } from './useApiResource'

export type UseBlogsResult = {
  /** Summaries, not full articles - a list carries no article bodies. */
  blogs: BlogSummary[]
  total: number
  page: number
  hasNext: boolean
  loading: boolean
  error: ApiError | null
  reload: () => void
}

/** A page of articles, kept in sync with `params`. */
export function useBlogs(params: BlogListParams = {}): UseBlogsResult {
  // listBlogs is a module-level import, so its identity is stable and the
  // effect inside useApiList cannot loop on it.
  const { items, ...rest } = useApiList(listBlogs, params)

  return { blogs: items, ...rest }
}

export type UseBlogResult = {
  blog: BlogResponse | null
  loading: boolean
  error: ApiError | null
  reload: () => void
}

/**
 * One article by id. Pass null or undefined while the id is still unknown.
 *
 * For the edit form. A draft's slug can still change, so an edit URL must not
 * depend on one.
 */
export function useBlog(id: string | null | undefined): UseBlogResult {
  const { item, ...rest } = useApiItem(getBlog, id)

  return { blog: item, ...rest }
}

/**
 * One article by its public address. For the reader's page.
 *
 * The same useApiItem as above: it only ever passes its second argument
 * through to the fetcher, so "the thing that identifies a record" can be a
 * slug just as well as a UUID. Nothing had to change to support this.
 */
export function useBlogBySlug(slug: string | null | undefined): UseBlogResult {
  const { item, ...rest } = useApiItem(getBlogBySlug, slug)

  return { blog: item, ...rest }
}

export type UseBlogActionsResult = {
  create: (payload: BlogCreatePayload) => Promise<BlogResponse>
  update: (id: string, payload: BlogUpdatePayload) => Promise<BlogResponse>
  remove: (id: string) => Promise<void>
  saving: boolean
  error: ApiError | null
  clearError: () => void
}

/**
 * The three writes, with the token and the in-flight flag handled once.
 *
 * Each action records the error and rethrows it, so a caller can both show the
 * shared banner and decide whether to navigate away - which for a long article
 * matters more than anywhere else in this app. Losing a half-written post is
 * annoying; losing a half-written article is an evening.
 */
export function useBlogActions(): UseBlogActionsResult {
  const { run, saving, error, clearError } = useAuthedAction()

  const create = useCallback(
    (payload: BlogCreatePayload) => run((token) => createBlog(payload, token)),
    [run],
  )

  const update = useCallback(
    (id: string, payload: BlogUpdatePayload) =>
      run((token) => updateBlog(id, payload, token)),
    [run],
  )

  const remove = useCallback(
    (id: string) => run((token) => deleteBlog(id, token)),
    [run],
  )

  return { create, update, remove, saving, error, clearError }
}
