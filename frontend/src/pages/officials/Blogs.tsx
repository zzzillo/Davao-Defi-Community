import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import BlogCard from '../../components/blogs/BlogCard'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import PaginationControls from '../../components/PaginationControls'
import PageHeader from '../../components/PageHeader'
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
  const [statusOpen, setStatusOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { query, setQuery, search, page, setPage } = useDebouncedSearchPagination()
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Blogs"
        subtitle="Write announcements, guides and community news."
        actionLabel="Create Blog"
        onAction={() => navigate('/admin/blogs/new')}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted"
          />
          <span className="sr-only">Search articles</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            placeholder="Search titles and summaries..."
            className="w-full rounded-lg border border-outline bg-surface-lowest py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </label>

        <div ref={statusRef} className="relative">
          <button
            type="button"
            aria-expanded={statusOpen}
            onClick={() => setStatusOpen((open) => !open)}
            className="flex h-10 w-40 items-center whitespace-nowrap rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <span className="flex-1 text-center">{tab}</span>
            <Icon name={statusOpen ? 'expand_less' : 'expand_more'} className="text-[18px]" />
          </button>
          {statusOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
              {TABS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTab(value)
                    setStatusOpen(false)
                    setPage(1)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-low ${
                    tab === value ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {value}
                  {tab === value && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
            {pageBlogs.map((blog) => (
              <div key={blog.id} className="group relative">
                <BlogCard blog={blog} to={`/admin/blogs/edit/${blog.id}`} showStatus wholeCardLink />

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
