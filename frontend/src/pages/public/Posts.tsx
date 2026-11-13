import Icon from '../../components/Icon'
import PaginationControls from '../../components/PaginationControls'
import PostCard from '../../components/posts/PostCard'
import { useDebouncedSearchPagination } from '../../hooks/useDebouncedSearchPagination'
import { useToastError } from '../../hooks/useToast'
import { usePosts } from '../../hooks/usePosts'

const PAGE_SIZE = 12

/**
 * The community's Events photo archive.
 *
 * No token, no permission: GET /posts serves published posts to anonymous
 * callers, so this works signed out. An official visiting sees exactly what a
 * visitor sees, which is the point of giving the public site its own URLs
 * instead of branching one page on a role.
 */
export default function PublicPosts() {
  const { query, setQuery, search, page, setPage } = useDebouncedSearchPagination()

  const { posts, total, loading, error, reload } = usePosts({
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
  useToastError(error)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Events</h1>
        <p className="text-on-surface-variant">
          Photos and stories from Davao DeFi Community activities.
        </p>
      </div>

      <label className="relative flex w-full items-center sm:w-72 sm:shrink-0 sm:self-end">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 text-[20px] text-muted"
        />
        <span className="sr-only">Search Events</span>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          placeholder="Search Events"
          className="w-full rounded-lg border border-outline bg-surface-lowest py-2 pl-10 pr-3 text-sm text-on-surface placeholder:text-muted focus:outline-none"
        />
      </label>

      {error && <div className="flex justify-end"><button type="button" onClick={reload} className="text-sm font-semibold underline underline-offset-2">Retry loading Events</button></div>}

      {loading && posts.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Loading Events...</p>
      ) : error ? null : posts.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {search ? `No Events match "${search}".` : 'No Events yet. Check back soon.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} to={`/events/${post.id}`} />
            ))}
          </div>
        </>
      )}

      <PaginationControls currentPage={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}
