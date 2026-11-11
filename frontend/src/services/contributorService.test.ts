import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api'
import { getContributor, listContributorBlogs, listContributors } from './contributorService'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return { ...actual, apiRequest: vi.fn() }
})

const request = vi.mocked(apiRequest)

describe('public contributor service', () => {
  beforeEach(() => {
    request.mockReset()
    request.mockResolvedValue(undefined as never)
  })

  it('uses anonymous public routes and preserves paging/search parameters', async () => {
    const signal = new AbortController().signal

    await listContributors({ search: 'builders', limit: 12, offset: 0 }, { signal })
    await getContributor('community builder', { signal })
    await listContributorBlogs('community-builder', { limit: 5, offset: 10 }, { signal })

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/users/contributors?search=builders&limit=12&offset=0',
      { signal },
    )
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/users/contributors/community%20builder',
      { signal },
    )
    expect(request).toHaveBeenNthCalledWith(
      3,
      '/users/contributors/community-builder/blogs?limit=5&offset=10',
      { signal },
    )

    for (const [, options] of request.mock.calls) {
      expect(options).not.toHaveProperty('token')
    }
  })
})
