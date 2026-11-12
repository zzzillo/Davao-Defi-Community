import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import BlogCard from '../../components/blogs/BlogCard'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import PaginationControls from '../../components/PaginationControls'
import PageHeader from '../../components/PageHeader'
import AdminListToolbar from '../../components/AdminListToolbar'
import { useDebouncedSearchPagination } from '../../hooks/useDebouncedSearchPagination'
import { useToast, useToastError } from '../../hooks/useToast'
import { useBlogActions, useBlogs } from '../../hooks/useBlogs'

type Tab = 'All' | 'Published' | 'Drafts'

const TABS: Tab[] = ['All', 'Published', 'Drafts']
const PAGE_SIZE = 12

/**
 * The officials' view of every article, drafts included.
 *
 * include_drafts needs the blogs.read permission. An official without it
 * simply sees published articles here, which is the correct outcome rather
 * than an error.
 */
export default function Blogs() {
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('Published')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { query, setQuery, search, page, setPage } = useDebouncedSearchPagination()

  const { blogs, loading, error, reload } = useBlogs({
    include_drafts: true,
    search: search || undefined,
    // Published is a stored column, so the server could filter it - but the
    // tab also has an "All" state and the officials' table is small. Past a
    // few hundred articles, add a `published` query parameter and move this
    // server-side, exactly as the events and posts tables will need.
    limit: 100,
  }, { management: true })

  const { remove, saving, error: actionError } = useBlogActions()
  const showToast = useToast()

  const visible = blogs.filter((blog) => {
    if (tab === 'Published') return blog.published
    if (tab === 'Drafts') return !blog.published

    return true
  })
  useToastError(error)
  useToastError(actionError)
  const pageBlogs = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pending = deleteId ? blogs.find((blog) => blog.id === deleteId) : null

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PageHeader
        title="Blogs"
        subtitle="Write announcements, guides and community news."
        actionLabel="Create Blog"
        onAction={() => navigate('/admin/blogs/new')}
        hideActionOnMobile
      />

      <AdminListToolbar
        actionLabel="Create Blog"
        onAction={() => navigate('/admin/blogs/new')}
        searchLabel="Search articles"
        searchPlaceholder="Search titles and summaries..."
        searchValue={query}
        onSearchChange={setQuery}
        selectedFilter={tab}
        filterLabel="Filter blogs"
        filterOptions={TABS}
        onFilterChange={(value) => {
          setTab(value)
          setPage(1)
        }}
      />

      {error && <div className="flex justify-end"><button type="button" onClick={reload} className="rounded-md px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-low">Retry loading blogs</button></div>}

      {loading ? (
        <p className="py-16 text-center text-sm text-muted">Loading articles...</p>
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {search
            ? `No articles match "${search}".`
            : 'No articles yet. Write the first one.'}
        </p>
      ) : (
        <>
          <div className="flex flex-col">
            {pageBlogs.map((blog, index) => (
              <div key={blog.id} className="group relative">
                <BlogCard
                  blog={blog}
                  to={`/admin/blogs/edit/${blog.id}`}
                  showStatus
                  wholeCardLink
                  compactTopSpacing={index === 0}
                />

                {/*
                  Outside the card rather than inside it: the headline is a
                  link, and a button nested in a link is invalid HTML that
                  browsers resolve unpredictably.
                */}
                <button
                  type="button"
                  aria-label={`Delete ${blog.title}`}
                  onClick={() => setDeleteId(blog.id)}
                  className="absolute right-0 top-8 z-20 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant opacity-0 transition-opacity hover:bg-surface-low hover:text-on-surface focus:opacity-100 group-hover:opacity-100 sm:opacity-100"
                >
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
            ))}
          </div>

        </>
      )}

      {!loading && !error && (
        <PaginationControls
          currentPage={page}
          total={visible.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title={saving ? 'Deleting...' : 'Delete article?'}
        message={
          pending?.published
            ? 'This article is published. Its address will stop working for anyone who has the link, and cannot be reused.'
            : 'This article will be permanently removed.'
        }
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return

          try {
            await remove(deleteId)
            showToast('success', 'Blog deleted')
            // Refetch rather than splicing the row out locally: the server
            // decides what exists, and a failed delete must not leave the list
            // claiming otherwise.
            reload()
          } catch {
            // useBlogActions captured it - the banner above shows it.
          } finally {
            setDeleteId(null)
          }
        }}
      />
    </div>
  )
}
