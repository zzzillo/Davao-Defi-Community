import { useState } from 'react'
import Icon from '../../components/Icon'
import PostCard from '../../components/posts/PostCard'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePosts } from '../../hooks/usePosts'

const PAGE_SIZE = 12

/**
 * The community's photo gallery.
 *
 * No token, no permission: GET /posts serves published posts to anonymous
 * callers, so this works signed out. An official visiting sees exactly what a
 * visitor sees, which is the point of giving the public site its own URLs
 * instead of branching one page on a role.
 */
export default function PublicPosts() {
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)

  // Search runs on the server, so wait for a pause in typing.
  const search = useDebouncedValue(query.trim(), 300)

  const { posts, total, hasNext, loading, error } = usePosts({
    search: search || undefined,
    limit: PAGE_SIZE,
    offset,
  })

  // Changing the search while on page 3 would ask for results 24-36 of a set
  // that may only have four. Resetting during render keeps the two in step
  // without an effect that would fetch the wrong page first and correct itself
  // afterwards.
  const [searchedFor, setSearchedFor] = useState(search)

  if (searchedFor !== search) {
    setSearchedFor(search)
    setOffset(0)
  }

  const showingFrom = total === 0 ? 0 : offset + 1
  const showingTo = offset + posts.length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Posts</h1>
        <p className="text-on-surface-variant">
          Photos and recaps from what the Davao DeFi Community has been doing.
        </p>
      </div>

      <label className="relative flex items-center sm:max-w-sm">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 text-[20px] text-muted"
        />
        <span className="sr-only">Search posts</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search posts"
          className="w-full rounded-lg border border-outline bg-surface-lowest py-2 pl-10 pr-3 text-sm text-on-surface placeholder:text-muted focus:border-outline-strong focus:outline-none"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
          {error.message}
        </p>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-muted">Loading posts...</p>
      ) : posts.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {search ? `No posts match "${search}".` : 'No posts yet. Check back soon.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} to={`/posts/${post.id}`} />
            ))}
          </div>

          {/*
            Shown only when there is more than one page. A pager under four
            results is furniture.
          */}
          {(offset > 0 || hasNext) && (
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="flex items-center gap-1 rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="chevron_left" className="text-[18px]" />
                Previous
              </button>

              <p className="text-sm text-muted">
                {showingFrom}-{showingTo} of {total}
              </p>

              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="flex items-center gap-1 rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <Icon name="chevron_right" className="text-[18px]" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
