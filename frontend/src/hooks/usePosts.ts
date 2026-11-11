/**
 * React's view of the posts API.
 *
 * Thin on purpose. Everything hard - the out-of-order request guard, the
 * effect key, the token handling, the in-flight flags - lives once in
 * useApiResource.ts. What remains here is naming: which service function, and
 * what the returned collection is called.
 *
 * Pages use these and stay free of fetch logic entirely.
 */

import { useCallback } from 'react'

import {
  createPost,
  deletePost,
  getPost,
  getManagedPost,
  listPosts,
  listManagedPosts,
  updatePost,
} from '../services/postService'
import type {
  PostCreatePayload,
  PostListParams,
  PostResponse,
  PostUpdatePayload,
} from '../types/post'
import { useApiItem, useApiList, useAuthedAction } from './useApiResource'
import type { ReadMode } from './useApiResource'
import type { ApiError } from '../services/api'

const POST_WRITE_RESOURCES = ['posts'] as const

export type UsePostsResult = {
  posts: PostResponse[]
  total: number
  page: number
  hasNext: boolean
  loading: boolean
  error: ApiError | null
  reload: () => void
}

/** A page of posts, kept in sync with `params`. */
export function usePosts(params: PostListParams = {}, mode: ReadMode = {}): UsePostsResult {
  // listPosts is a module-level import, so its identity is stable and the
  // effect inside useApiList cannot loop on it.
  const { items, ...rest } = useApiList(mode.management ? listManagedPosts : listPosts, params, { ...mode, resource: 'posts' })

  return { posts: items, ...rest }
}

export type UsePostResult = {
  post: PostResponse | null
  loading: boolean
  error: ApiError | null
  reload: () => void
}

/** One post by id. Pass null or undefined while the id is still unknown. */
export function usePost(id: string | null | undefined, mode: ReadMode = {}): UsePostResult {
  const { item, ...rest } = useApiItem(mode.management ? getManagedPost : getPost, id, { ...mode, resource: 'posts' })

  return { post: item, ...rest }
}

export type UsePostActionsResult = {
  create: (payload: PostCreatePayload) => Promise<PostResponse>
  update: (id: string, payload: PostUpdatePayload) => Promise<PostResponse>
  remove: (id: string) => Promise<void>
  saving: boolean
  error: ApiError | null
  clearError: () => void
}

/**
 * The three writes, with the token and the in-flight flag handled once.
 *
 * Each action records the error and rethrows it, so a caller can both show the
 * shared banner and decide whether to navigate away.
 */
export function usePostActions(): UsePostActionsResult {
  const { run, saving, error, clearError } = useAuthedAction(POST_WRITE_RESOURCES)

  const create = useCallback(
    (payload: PostCreatePayload) => run((token) => createPost(payload, token)),
    [run],
  )

  const update = useCallback(
    (id: string, payload: PostUpdatePayload) =>
      run((token) => updatePost(id, payload, token)),
    [run],
  )

  const remove = useCallback(
    (id: string) => run((token) => deletePost(id, token)),
    [run],
  )

  return { create, update, remove, saving, error, clearError }
}
