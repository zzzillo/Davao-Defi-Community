import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import PaginationControls from '../../components/PaginationControls'
import PageHeader from '../../components/PageHeader'
import AdminListToolbar from '../../components/AdminListToolbar'
import PostCard from '../../components/posts/PostCard'
import { useDebouncedSearchPagination } from '../../hooks/useDebouncedSearchPagination'
import { useToast, useToastError } from '../../hooks/useToast'
import { usePostActions, usePosts } from '../../hooks/usePosts'

type Tab = 'All' | 'Posted' | 'Drafts'

const TABS: Tab[] = ['All', 'Posted', 'Drafts']
const PAGE_SIZE = 12

/**
 * The officials' view of every post, drafts included.
 *
 * include_drafts needs the posts.read permission. An official without it
 * simply sees published posts here, which is the correct outcome rather than
 * an error.
 */
export default function Posts() {
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('Posted')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { query, setQuery, search, page, setPage } = useDebouncedSearchPagination()

  const { posts, loading, error, reload } = usePosts({
    include_drafts: true,
    search: search || undefined,
    // Published is a stored column, so the server could filter it - but the
    // tab also has an "All" state and the officials' table is small. Past a
    // few hundred posts, add a `published` query parameter and move this
    // server-side, exactly as the events table will need.
    limit: 100,
  }, { management: true })
  const { remove, saving, error: actionError } = usePostActions()
  const showToast = useToast()
  useToastError(error)
  useToastError(actionError)

  const visible = posts.filter((post) => {
    if (tab === 'Posted') return post.published
    if (tab === 'Drafts') return !post.published

    return true
  })
  const pagePosts = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PageHeader
        title="Recaps"
        subtitle="Share photos and updates with the community."
        actionLabel="Create Recap"
        onAction={() => navigate('/admin/posts/new')}
        hideActionOnMobile
      />

      <AdminListToolbar
        actionLabel="Create Recap"
        onAction={() => navigate('/admin/posts/new')}
        searchLabel="Search recaps"
        searchPlaceholder="Search recaps..."
        searchValue={query}
        onSearchChange={setQuery}
        selectedFilter={tab}
        filterLabel="Filter recaps"
        filterOptions={TABS}
        onFilterChange={(value) => {
          setTab(value)
          setPage(1)
        }}
      />

      {error && <div className="flex justify-end"><button type="button" onClick={reload} className="rounded-md px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-low">Retry loading recaps</button></div>}

      {loading ? (
        <p className="py-16 text-center text-sm text-muted">Loading recaps...</p>
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {search ? `No recaps match "${search}".` : 'No recaps yet. Create the first one.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pagePosts.map((post) => (
              <div key={post.id} className="relative h-full">
                <PostCard post={post} to={`/admin/posts/edit/${post.id}`} showStatus />

                {/*
                  Outside the card rather than inside it: the card is a link,
                  and a button nested in a link is invalid HTML that browsers
                  resolve unpredictably. Absolute positioning puts it on top
                  without putting it inside.
                */}
                <button
                  type="button"
                  aria-label={`Delete ${post.title ?? 'this recap'}`}
                  onClick={() => setDeleteId(post.id)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 focus:opacity-100 group-hover:opacity-100 sm:opacity-100"
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
        title={saving ? 'Deleting...' : 'Delete recap?'}
        message="This recap and its photos will be permanently removed."
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return

          try {
            await remove(deleteId)
            showToast('success', 'Recap deleted')
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
