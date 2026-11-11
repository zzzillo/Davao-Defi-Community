import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './api'
import { listBlogs, listManagedBlogs } from './blogService'
import { uploadImage } from './storageService'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API request boundary', () => {
  it('always calls the real public endpoint without inheriting a signed-in token', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ items: [], total: 0, limit: 20, offset: 0, page: 1, has_next: false }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await listBlogs({ limit: 20 }, { token: 'should-not-be-forwarded' })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/blogs?limit=20')
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
  })

  it('uses a separate authenticated management endpoint for private lists', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ items: [], total: 0, limit: 20, offset: 0, page: 1, has_next: false }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await listBlogs({ include_drafts: true })
    await listManagedBlogs({ search: 'draft', limit: 20 }, { token: 'session-token' })

    const [publicUrl, publicInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const [managementUrl, managementInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(publicUrl).toContain('/blogs?include_drafts=true')
    expect(new Headers(publicInit.headers).has('Authorization')).toBe(false)
    expect(managementUrl).toContain('/admin/blogs?search=draft&limit=20')
    expect(new Headers(managementInit.headers).get('Authorization')).toBe('Bearer session-token')
  })

  it('sends uploads as raw authenticated image bytes and returns the stored key', async () => {
    const payload = {
      id: 'media-id',
      storage_key: 'media/recap_image/uploader/asset.webp',
      purpose: 'recap_image',
      public_url: 'https://media.example/asset.webp',
      content_type: 'image/webp',
      byte_size: 4,
      width: 2,
      height: 2,
      validation_status: 'valid',
    }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(payload), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'cover.webp', { type: 'image/webp' })

    const uploaded = await uploadImage(file, 'session-token', { purpose: 'recap_image' })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/media/uploads?purpose=recap_image')
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer session-token')
    expect(new Headers(init.headers).get('Content-Type')).toBe('image/webp')
    expect(init.body).toBe(file)
    expect(uploaded.image_key).toBe(payload.storage_key)
    expect(uploaded.image_url).toBe(payload.public_url)
  })

  it('includes the owner id for private uploads made on another author’s behalf', async () => {
    const payload = {
      id: 'media-id',
      storage_key: 'media/blog_cover/uploader/asset.webp',
      purpose: 'blog_cover',
      public_url: 'https://media.example/asset.webp',
      content_type: 'image/webp',
      byte_size: 4,
      width: 2,
      height: 2,
      validation_status: 'valid',
    }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(payload), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'cover.webp', { type: 'image/webp' })

    await uploadImage(file, 'session-token', {
      purpose: 'blog_cover',
      ownerUserId: 'blog-owner-id',
    })

    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(new URL(url).searchParams.get('purpose')).toBe('blog_cover')
    expect(new URL(url).searchParams.get('owner_user_id')).toBe('blog-owner-id')
  })

  it('rejects unsupported images before sending a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['not a raster'], 'animation.gif', { type: 'image/gif' })

    await expect(uploadImage(file, 'session-token')).rejects.toMatchObject({
      status: 415,
      reason: 'unsupported_image_type',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps only safe invitation recovery details on API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      detail: {
        reason: 'invitation_delivery_uncertain',
        message: 'Delivery needs reconciliation.',
        invitation_id: 'local-invite-id',
        status: 'failed',
        clerk_invitation_id: 'private-provider-id',
      },
    }), { status: 502 })))

    try {
      await apiRequest('/admin/invitations', { method: 'POST', token: 'session-token', body: { email: 'member@example.org' } })
      throw new Error('Expected request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).details).toEqual({
        reason: 'invitation_delivery_uncertain',
        message: 'Delivery needs reconciliation.',
        invitation_id: 'local-invite-id',
        status: 'failed',
      })
      expect(JSON.stringify((error as ApiError).details)).not.toContain('private-provider-id')
    }
  })
})
