import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlogResponse } from '../types/blog'
import type { PostResponse } from '../types/post'
import BlogForm from './blogs/BlogForm'
import PartnerForm from './partners/PartnerForm'
import PostForm from './posts/PostForm'

const { uploadImage } = vi.hoisted(() => ({ uploadImage: vi.fn() }))

vi.mock('../services/storageService', () => ({
  STORAGE_CONFIGURED: true,
  uploadImage,
}))

vi.mock('../auth/useAppAuth', () => ({
  useAppAuth: () => ({ getToken: async () => 'test-token' }),
}))

vi.mock('./RichTextEditor', () => ({ default: () => <div aria-label="Article editor" /> }))

let previewId = 0

beforeEach(() => {
  uploadImage.mockReset()
  uploadImage.mockImplementation(async (_file: File, _token: string, options: { purpose: string }) => ({
    id: `uploaded-${options.purpose}`,
    storage_key: `media/${options.purpose}/saved.webp`,
    public_url: `https://cdn.example/${options.purpose}/saved.webp`,
    image_key: `media/${options.purpose}/saved.webp`,
    image_url: `https://cdn.example/${options.purpose}/saved.webp`,
    purpose: options.purpose,
  }))
  previewId = 0
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => `blob:upload-${++previewId}`),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})

afterEach(cleanup)

function png(name: string) {
  return new File(['image-data'], name, { type: 'image/png' })
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('Expected a file input')
  return input
}

function postWithStoredImage(): PostResponse {
  return {
    id: 'post-existing',
    title: 'Community recap',
    description: null,
    location: null,
    post_date: '2026-10-01',
    published: false,
    created_at: '2026-10-01T10:00:00+08:00',
    updated_at: '2026-10-01T10:00:00+08:00',
    creator: null,
    event: {
      id: 'rsvp-linked-gallery',
      title: 'RSVP title',
      start_datetime: '2026-09-30T10:00:00+08:00',
      published: true,
    },
    images: [{
      id: 'stored-image',
      display_order: 0,
      image_key: 'media/recap_image/existing.webp',
      image_url: 'https://cdn.example/recap_image/existing.webp',
    }],
  }
}

function blogForOwner(): BlogResponse {
  return {
    id: 'blog-existing',
    title: 'Published by someone else',
    slug: 'published-by-someone-else',
    excerpt: 'A short summary.',
    published: false,
    published_at: null,
    created_at: '2026-10-01T10:00:00+08:00',
    updated_at: '2026-10-01T10:00:00+08:00',
    creator: { id: 'blog-owner-id', display_name: 'Original author' },
    cover_image_key: null,
    cover_image_url: null,
    content: '<p>Existing draft body.</p>',
  }
}

describe('content image uploads', () => {
  it('saves a blog cover only after upload returns its storage key', async () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <BlogForm saving={false} error={null} onSubmit={onSubmit} onCancel={() => {}} />,
    )
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'A real draft' } })
    fireEvent.change(fileInput(container), { target: { files: [png('cover.png')] } })

    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(
      expect.any(File),
      'test-token',
      expect.objectContaining({ purpose: 'blog_cover', signal: expect.any(AbortSignal) }),
    ))
    const save = screen.getByRole('button', { name: 'Save Draft' }) as HTMLButtonElement
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.click(save)

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      cover_image_key: 'media/blog_cover/saved.webp',
    }))
  })

  it('uploads an edited blog cover for the blog owner', async () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <BlogForm blog={blogForOwner()} saving={false} error={null} onSubmit={onSubmit} onCancel={() => {}} />,
    )
    fireEvent.change(fileInput(container), { target: { files: [png('replacement-cover.png')] } })

    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(
      expect.any(File),
      'test-token',
      expect.objectContaining({
        purpose: 'blog_cover',
        ownerUserId: 'blog-owner-id',
        signal: expect.any(AbortSignal),
      }),
    ))
    const save = screen.getByRole('button', { name: 'Save Draft' }) as HTMLButtonElement
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.click(save)

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      cover_image_key: 'media/blog_cover/saved.webp',
    }))
  })

  it('blocks a blog save after a selected cover upload fails', async () => {
    uploadImage.mockRejectedValueOnce(new Error('Storage is unavailable.'))
    const onSubmit = vi.fn()
    const { container } = render(
      <BlogForm saving={false} error={null} onSubmit={onSubmit} onCancel={() => {}} />,
    )
    fireEvent.change(fileInput(container), { target: { files: [png('cover.png')] } })

    await screen.findByRole('alert')
    const save = screen.getByRole('button', { name: 'Save Draft' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(save)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('uploads recap photos, submits the returned key, and preserves stored photos', async () => {
    const onSubmit = vi.fn()
    const { container, rerender } = render(
      <PostForm saving={false} error={null} onSubmit={onSubmit} onCancel={() => {}} />,
    )
    fireEvent.change(fileInput(container), { target: { files: [png('recap.png')] } })
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(
      expect.any(File),
      'test-token',
      expect.objectContaining({ purpose: 'recap_image', signal: expect.any(AbortSignal) }),
    ))

    const save = screen.getByRole('button', { name: 'Save Draft' }) as HTMLButtonElement
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.click(save)
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({
      event_id: null,
      images: [{ image_key: 'media/recap_image/saved.webp' }],
    }))

    onSubmit.mockClear()
    rerender(<PostForm post={postWithStoredImage()} saving={false} error={null} onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(uploadImage).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      event_id: null,
      images: [{ image_key: 'media/recap_image/existing.webp' }],
    }))
  })

  it('keeps a failed recap photo selected and blocks draft submission until removed', async () => {
    uploadImage.mockRejectedValueOnce(new Error('Upload failed.'))
    const onSubmit = vi.fn()
    const { container } = render(
      <PostForm saving={false} error={null} onSubmit={onSubmit} onCancel={() => {}} />,
    )
    fireEvent.change(fileInput(container), { target: { files: [png('recap.png')] } })

    await screen.findByRole('alert')
    const save = screen.getByRole('button', { name: 'Save Draft' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Retry upload for photo 1' })).toBeTruthy()
    fireEvent.click(save)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not accept SVG recap files', async () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <PostForm saving={false} error={null} onSubmit={onSubmit} onCancel={() => {}} />,
    )
    fireEvent.change(fileInput(container), {
      target: { files: [new File(['<svg/>'], 'recap.svg', { type: 'image/svg+xml' })] },
    })

    expect(await screen.findByText('Only JPEG, PNG, and WebP photos are accepted.')).toBeTruthy()
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('saves a partner logo key and blocks a failed selected logo', async () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <PartnerForm saving={false} error={null} onSubmit={onSubmit} onCancel={() => {}} />,
    )
    fireEvent.change(screen.getByPlaceholderText('e.g. Nexus Technologies'), { target: { value: 'Nexus' } })
    fireEvent.change(fileInput(container), { target: { files: [png('logo.png')] } })
    const save = screen.getByRole('button', { name: 'Save Partner' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(
      expect.any(File),
      'test-token',
      expect.objectContaining({ purpose: 'partner_logo', signal: expect.any(AbortSignal) }),
    ))
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.click(save)
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Nexus',
      logo_key: 'media/partner_logo/saved.webp',
    }))
  })

  it('rejects SVG partner logos while still allowing a name-only save', async () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <PartnerForm saving={false} error={null} onSubmit={onSubmit} onCancel={() => {}} />,
    )
    fireEvent.change(screen.getByPlaceholderText('e.g. Nexus Technologies'), { target: { value: 'Nexus' } })
    fireEvent.change(fileInput(container), {
      target: { files: [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })] },
    })

    expect(await screen.findByText('Choose a JPEG, PNG, or WebP image. SVG files are not accepted.')).toBeTruthy()
    expect(uploadImage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save Partner' }))
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Nexus', logo_key: null })
  })
})
