import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import PostCard from '../../components/posts/PostCard'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePostActions, usePosts } from '../../hooks/usePosts'

type Tab = 'All' | 'Published' | 'Drafts'

const TABS: Tab[] = ['All', 'Published', 'Drafts']

/**
 * The officials' view of every post, drafts included.
 *
 * include_drafts needs the posts.read permission. An official without it
 * simply sees published posts here, which is the correct outcome rather than
 * an error.
 */
export default function Posts() {
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('All')
  const [query, setQuery] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Search runs on the server, so wait for a pause instead of firing a request
  // per keystroke.
  const search = useDebouncedValue(query.trim(), 300)

  const { posts, total, loading, error, reload } = usePosts({
    include_drafts: true,
    search: search || undefined,
    // Published is a stored column, so the server could filter it - but the
    // tab also has an "All" state and the officials' table is small. Past a
    // few hundred posts, add a `published` query parameter and move this
    // server-side, exactly as the events table will need.
    limit: 100,
  })

  const { remove, saving } = usePostActions()

  const visible = posts.filter((post) => {
    if (tab === 'Published') return post.published
    if (tab === 'Drafts') return !post.published

    return true
  })

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Posts"
        subtitle="Share photos and updates with the community."
        actionLabel="Create Post"
        onAction={() => navigate('/admin/posts/new')}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted"
          />
          <span className="sr-only">Search posts</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search posts..."
            className="w-full rounded-lg border border-outline bg-surface-lowest py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </label>

        <div className="flex gap-1 rounded-lg bg-surface-low p-1">
          {TABS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === value
                  ? 'bg-surface-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
          {error.message}
        </p>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-muted">Loading posts...</p>
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {search ? `No posts match "${search}".` : 'No posts yet. Create the first one.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((post) => (
              <div key={post.id} className="relative">
                <PostCard post={post} to={`/admin/posts/edit/${post.id}`} showStatus />

                {/*
                  Outside the card rather than inside it: the card is a link,
                  and a button nested in a link is invalid HTML that browsers
                  resolve unpredictably. Absolute positioning puts it on top
                  without putting it inside.
                */}
                <button
                  type="button"
                  aria-label={`Delete ${post.title ?? 'this post'}`}
                  onClick={() => setDeleteId(post.id)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 focus:opacity-100 group-hover:opacity-100 sm:opacity-100"
                >
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted">
            Showing {visible.length} of {total}
          </p>
        </>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title={saving ? 'Deleting...' : 'Delete post?'}
        message="This post and its photos will be permanently removed."
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return

          try {
            await remove(deleteId)
            // Refetch rather than splicing the row out locally: the server
            // decides what exists, and a failed delete must not leave the list
            // claiming otherwise.
            reload()
          } catch {
            // usePostActions captured it - the banner above shows it.
          } finally {
            setDeleteId(null)
          }
        }}
      />
    </div>
  )
}
