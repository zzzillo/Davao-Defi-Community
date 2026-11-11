import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlogListResponse, BlogSummary } from '../types/blog'
import type { ContributorListResponse, ContributorResponse } from '../types/contributor'
import { ApiError } from '../services/api'
import * as contributorService from '../services/contributorService'
import { clearAllResourceCache, invalidateResource } from '../services/resourceCache'
import { useContributorBlogs, useContributors } from './useContributors'

vi.mock('../services/contributorService', () => ({
  getContributor: vi.fn(),
  listContributorBlogs: vi.fn(),
  listContributors: vi.fn(),
}))

const blog = (slug: string): BlogSummary => ({
  id: `${slug}-id`,
  title: `${slug} article`,
  slug: `${slug}-article`,
  excerpt: null,
  published: true,
  published_at: '2026-10-10T12:00:00+08:00',
  created_at: '2026-10-10T12:00:00+08:00',
  updated_at: '2026-10-10T12:00:00+08:00',
  creator: null,
  cover_image_key: null,
  cover_image_url: null,
})

const blogPage = (item: BlogSummary): BlogListResponse => ({
  items: [item],
  total: 1,
  limit: 5,
  offset: 0,
  page: 1,
  has_next: false,
})

const contributor = (publicSlug: string): ContributorResponse => ({
  display_name: publicSlug,
  public_slug: publicSlug,
  alias: null,
  bio: null,
  profile_photo_key: null,
  profile_photo_url: null,
  positions: [],
  contributions: [],
  social_links: {},
})

const contributorPage = (item: ContributorResponse): ContributorListResponse => ({
  items: [item],
  total: 1,
  limit: 20,
  offset: 0,
  page: 1,
  has_next: false,
})

describe('useContributorBlogs', () => {
  const listBlogs = vi.mocked(contributorService.listContributorBlogs)
  const listContributors = vi.mocked(contributorService.listContributors)

  beforeEach(() => {
    clearAllResourceCache()
    listBlogs.mockReset()
    listContributors.mockReset()
  })

  it('does not show a previous contributor’s late response after the slug changes', async () => {
    let resolveFirst: (response: BlogListResponse) => void = () => undefined
    listBlogs.mockImplementation((publicSlug) => {
      if (publicSlug === 'first-builder') {
        return new Promise((resolve) => { resolveFirst = resolve })
      }
      return Promise.resolve(blogPage(blog('second-builder')))
    })

    const { result, rerender } = renderHook(
      ({ slug }) => useContributorBlogs(slug, { limit: 5, offset: 0 }),
      { initialProps: { slug: 'first-builder' } },
    )

    await waitFor(() => expect(listBlogs).toHaveBeenCalledWith(
      'first-builder',
      { limit: 5, offset: 0 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))

    rerender({ slug: 'second-builder' })
    await waitFor(() => expect(result.current.blogs[0]?.id).toBe('second-builder-id'))

    await act(async () => {
      resolveFirst(blogPage(blog('first-builder')))
    })

    expect(result.current.blogs.map((item) => item.id)).toEqual(['second-builder-id'])
    expect(result.current.error).toBeNull()
  })

  it('clears the old contributor’s blogs and exposes a failed new request', async () => {
    listBlogs.mockImplementation((publicSlug) => publicSlug === 'first-builder'
      ? Promise.resolve(blogPage(blog('first-builder')))
      : Promise.reject(new ApiError(503, 'The contributor blog service is unavailable.')))

    const { result, rerender } = renderHook(
      ({ slug }) => useContributorBlogs(slug, { limit: 5, offset: 0 }),
      { initialProps: { slug: 'first-builder' } },
    )

    await waitFor(() => expect(result.current.blogs[0]?.id).toBe('first-builder-id'))

    rerender({ slug: 'second-builder' })
    expect(result.current.blogs).toEqual([])

    await waitFor(() => expect(result.current.error?.status).toBe(503))
    expect(result.current.loading).toBe(false)
    expect(result.current.blogs).toEqual([])
  })

  it('refreshes the cached public directory when a users change event arrives', async () => {
    listContributors
      .mockResolvedValueOnce(contributorPage(contributor('first')))
      .mockResolvedValueOnce(contributorPage(contributor('updated')))

    const { result } = renderHook(() => useContributors({ limit: 20 }))
    await waitFor(() => expect(result.current.contributors[0]?.public_slug).toBe('first'))

    act(() => invalidateResource('users'))

    await waitFor(() => expect(result.current.contributors[0]?.public_slug).toBe('updated'))
    expect(listContributors).toHaveBeenCalledTimes(2)
  })
})
