import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import PartnerGrid from '../../components/partners/PartnerGrid'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePartnerActions, usePartners } from '../../hooks/usePartners'

/**
 * The officials' view of every partner.
 *
 * No tabs, unlike the events, posts and blogs tables. Those all filter by
 * draft state; partners have none, so there is nothing to filter and this page
 * is the same grid a visitor sees plus two buttons on each card.
 */
export default function Partners() {
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Search runs on the server, so wait for a pause instead of firing a request
  // per keystroke.
  const search = useDebouncedValue(query.trim(), 300)

  const { partners, total, loading, error, reload } = usePartners({
    search: search || undefined,
    // A logo wall is meant to be seen whole - paging through sponsors is not
    // a thing anyone wants to do. 100 is the shared cap; past that, add a
    // pager here exactly as the public posts page has one.
    limit: 100,
  })

  const { remove, saving } = usePartnerActions()

  const pending = deleteId ? partners.find((partner) => partner.id === deleteId) : null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Partners"
        subtitle="Organizations that collaborate with the community."
        actionLabel="Add Partner"
        onAction={() => navigate('/admin/partners/new')}
      />

      <label className="relative min-w-64 max-w-sm flex-1">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted"
        />
        <span className="sr-only">Search partners</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search partners..."
          className="w-full rounded-lg border border-outline bg-surface-lowest py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
          {error.message}
        </p>
      )}

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
          <PartnerGrid
            partners={partners}
            onEdit={(partner) => navigate(`/admin/partners/edit/${partner.id}`)}
            onDelete={(partner) => setDeleteId(partner.id)}
          />

          <p className="text-sm text-muted">
            Showing {partners.length} of {total}
          </p>
        </>
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
            // Refetch rather than splicing the card out locally: the server
            // decides what exists, and a failed delete must not leave the grid
            // claiming otherwise.
            reload()
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
