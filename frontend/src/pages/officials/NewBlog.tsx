import { useNavigate, useParams } from 'react-router-dom'

import BlogForm from '../../components/blogs/BlogForm'
import { useBlog, useBlogActions } from '../../hooks/useBlogs'
import type { BlogCreatePayload } from '../../types/blog'

/**
 * Create or edit an article.
 *
 * One component for both routes, the way NewPost and NewEvent serve /new and
 * /edit/:id. On /admin/blogs/new the hook is handed undefined and stays idle;
 * on /admin/blogs/edit/:id it fetches.
 *
 * The page orchestrates and BlogForm renders: the hooks live here, the form
 * state lives there, and neither knows how the other works.
 *
 * Replaced a 1,136-line version that implemented a block-based editor - text,
 * media, divider, link, embed - against mock data. That was the structured
 * document model this project considered and chose against, hand-rolled
 * without a library's guarantees and with nothing to save to.
 */
export default function NewBlog() {
  const navigate = useNavigate()
  const { id } = useParams()

  const { blog, loading: loadingBlog, error: loadError } = useBlog(id)
  const { create, update, saving, error: saveError } = useBlogActions()

  async function handleSubmit(payload: BlogCreatePayload) {
    try {
      if (blog) {
        await update(blog.id, payload)
      } else {
        await create(payload)
      }

      navigate('/admin/blogs')
    } catch {
      // useBlogActions already captured it and BlogForm shows it. Staying on
      // the page matters more here than anywhere else in this app: navigating
      // away from a failed save would discard an entire article.
    }
  }

  // Rendering the form before the article arrives would show an empty form
  // that fills itself in a moment later, which reads as a glitch - and for the
  // editor it would be worse than that, because RichTextEditor seeds itself on
  // mount and would have seeded from nothing.
  if (id && loadingBlog) {
    return <p className="py-24 text-center text-sm text-muted">Loading article...</p>
  }

  if (id && loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-on-surface">Article not found</p>
        <p className="max-w-md text-sm text-on-surface-variant">{loadError.message}</p>
        <button
          type="button"
          onClick={() => navigate('/admin/blogs')}
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Back to Blogs
        </button>
      </div>
    )
  }

  return (
    <BlogForm
      blog={blog}
      saving={saving}
      error={saveError}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/admin/blogs')}
    />
  )
}
