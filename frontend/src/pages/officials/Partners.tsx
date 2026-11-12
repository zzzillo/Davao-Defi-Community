import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ConfirmDialog from '../../components/ConfirmDialog'
import PaginationControls from '../../components/PaginationControls'
import PageHeader from '../../components/PageHeader'
import AdminListToolbar from '../../components/AdminListToolbar'
import PartnerGrid from '../../components/partners/PartnerGrid'
import { useDebouncedSearchPagination } from '../../hooks/useDebouncedSearchPagination'
import { useToast, useToastError } from '../../hooks/useToast'
import { usePartnerActions, usePartners } from '../../hooks/usePartners'

const PAGE_SIZE = 12

/**
 * The officials' view of every partner.
 *
 * No tabs, unlike the events, posts and blogs tables. Those all filter by
 * draft state; partners have none, so there is nothing to filter and this page
 * is the same grid a visitor sees plus two buttons on each card.
 */
export default function Partners() {
  const navigate = useNavigate()

  const { query, setQuery, search, page, setPage } = useDebouncedSearchPagination()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { partners, total, loading, error, reload } = usePartners({
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  }, { management: true })
  const { remove, reorder, saving, error: actionError } = usePartnerActions()
  const showToast = useToast()
  useToastError(error)
  useToastError(actionError)

  const pending = deleteId ? partners.find((partner) => partner.id === deleteId) : null

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PageHeader
        title="Partners"
        subtitle="Organizations that collaborate with the community."
        actionLabel="Add Partner"
        onAction={() => navigate('/admin/partners/new')}
        hideActionOnMobile
      />

      <AdminListToolbar
        actionLabel="Add Partner"
        onAction={() => navigate('/admin/partners/new')}
        searchLabel="Search partners"
        searchPlaceholder="Search partners..."
        searchValue={query}
        onSearchChange={setQuery}
      />

      {error && <div className="flex justify-end"><button type="button" onClick={reload} className="rounded-md px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-low">Retry loading partners</button></div>}

      {loading ? (
        <p className="py-16 text-center text-sm text-muted">Loading partners...</p>
      ) : partners.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {search
            ? `No partners match "${search}".`
            : 'No partners yet. Add the first one.'}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted">Drag a partner card to arrange the public partners page.</p>
          <PartnerGrid
            partners={partners}
            onEdit={(partner) => navigate(`/admin/partners/edit/${partner.id}`)}
            onDelete={(partner) => setDeleteId(partner.id)}
            onReorder={async (orderedPartners) => {
              await reorder(orderedPartners.map((partner) => partner.id))
              showToast('success', 'Partner order saved')
              reload()
            }}
          />

        </>
      )}

      {!loading && !error && (
        <PaginationControls
          currentPage={page}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title={saving ? 'Deleting...' : 'Delete partner?'}
        message={
          pending
            ? `${pending.name} will be removed from the public partners page.`
            : 'This partner will be permanently removed.'
        }
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return

          try {
            await remove(deleteId)
            showToast('success', 'Partner removed')
            // Refetch rather than splicing the card out locally: the server
            // decides what exists, and a failed delete must not leave the grid
            // claiming otherwise.
            reload()
            setPage(1)
          } catch {
            // usePartnerActions captured it - the banner above shows it.
          } finally {
            setDeleteId(null)
          }
        }}
      />
    </div>
  )
}
