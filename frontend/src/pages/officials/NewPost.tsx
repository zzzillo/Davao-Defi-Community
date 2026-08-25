import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PostForm from '../../components/posts/PostForm'
import { usePost, usePostActions } from '../../hooks/usePosts'
import type { PostCreatePayload } from '../../types/post'

/**
 * Create or edit a post.
 *
 * One component for both routes, the way NewEvent serves /new and /edit/:id.
 * On /admin/posts/new the hook is handed undefined and stays idle; on
 * /admin/posts/edit/:id it fetches.
 *
 * The page orchestrates and PostForm renders: the hooks live here, the form
 * state lives there, and neither knows how the other works. That is what lets
 * the same form be dropped into a different route later without carrying its
 * saving logic along.
 */
export default function NewPost() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()

  const { post, loading: loadingPost, error: loadError } = usePost(id)
  const { create, update, saving, error: saveError } = usePostActions()

  // The events table links here as /admin/posts/new?event=<id> to start the
  // recap for a particular event.
  const presetEventId = searchParams.get('event')

  async function handleSubmit(payload: PostCreatePayload) {
    try {
      if (post) {
        await update(post.id, payload)
      } else {
        await create(payload)
      }

      navigate('/admin/posts')
    } catch {
      // usePostActions already captured it and PostForm shows it. Staying on
      // the page is the point: navigating away would discard what was typed.
    }
  }

  // Rendering the form before the post arrives would show an empty form that
  // fills itself in a moment later, which reads as a glitch.
  if (id && loadingPost) {
    return <p className="py-24 text-center text-sm text-muted">Loading post...</p>
  }

  if (id && loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-on-surface">Post not found</p>
        <p className="max-w-md text-sm text-on-surface-variant">{loadError.message}</p>
        <button
          type="button"
          onClick={() => navigate('/admin/posts')}
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Back to Posts
        </button>
      </div>
    )
  }

  return (
    <PostForm
      post={post}
      initialEventId={presetEventId}
      saving={saving}
      error={saveError}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/admin/posts')}
    />
  )
}
