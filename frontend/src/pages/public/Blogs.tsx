import BlogCard from '../../components/blogs/BlogCard'
import Icon from '../../components/Icon'
import PaginationControls from '../../components/PaginationControls'
import { useDebouncedSearchPagination } from '../../hooks/useDebouncedSearchPagination'
import { useToastError } from '../../hooks/useToast'
import { useBlogs } from '../../hooks/useBlogs'

const PAGE_SIZE = 12

/**
 * The community's writing.
 *
 * No token, no permission: GET /blogs serves published articles to anonymous
 * callers, so this works signed out. An official visiting sees exactly what a
 * visitor sees, which is the point of giving the public site its own URLs
 * instead of branching one page on a role.
 */
export default function PublicBlogs() {
  const { query, setQuery, search, page, setPage } = useDebouncedSearchPagination()

  const { blogs, total, loading, error, reload } = useBlogs({
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
  useToastError(error)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Blog</h1>
        <p className="text-on-surface-variant">
          Announcements, guides, and news from the Davao DeFi Community.
        </p>
      </div>

      <label className="relative flex w-full items-center sm:w-72 sm:shrink-0 sm:self-end">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 text-[20px] text-muted"
        />
        <span className="sr-only">Search articles</span>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          placeholder="Search articles"
          className="w-full rounded-lg border border-outline bg-surface-lowest py-2 pl-10 pr-3 text-sm text-on-surface placeholder:text-muted focus:outline-none"
        />
      </label>

      {error && <div className="flex justify-end"><button type="button" onClick={reload} className="text-sm font-semibold underline underline-offset-2">Retry loading articles</button></div>}

      {loading && blogs.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Loading articles...</p>
      ) : error ? null : blogs.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {search
            ? `No articles match "${search}".`
            : 'Nothing published yet. Check back soon.'}
        </p>
      ) : (
        <>
          <div className="flex flex-col">
            {blogs.map((blog) => (
              // Linked by slug, not by id. The slug is the address this
              // article keeps - it is frozen once published, precisely so a
              // link like this one keeps working.
              <BlogCard key={blog.id} blog={blog} to={`/blog/${blog.slug}`} wholeCardLink />
            ))}
          </div>

        </>
      )}

      <PaginationControls currentPage={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}
