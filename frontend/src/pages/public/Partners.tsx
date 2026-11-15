import { useState } from 'react'
import PaginationControls from '../../components/PaginationControls'
import PartnerGrid from '../../components/partners/PartnerGrid'
import { usePartners } from '../../hooks/usePartners'
import { useToastError } from '../../hooks/useToast'
import { SkeletonGrid } from '../../components/PageSkeleton'

const PAGE_SIZE = 24

/**
 * The public partners wall.
 *
 * Public partner directory, paginated to keep the grid manageable.
 *
 * No token and no permission - GET /partners takes no auth dependency at all,
 * unlike the other three public lists, because partners have no draft state
 * for one to guard.
 */
export default function PublicPartners() {
  const [page, setPage] = useState(1)
  const { partners, total, loading, error, reload } = usePartners({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
  useToastError(error)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Partners</h1>
        <p className="text-on-surface-variant">
          The organizations building alongside the Davao DeFi Community.
        </p>
      </div>

      {error && <div className="flex justify-end"><button type="button" onClick={reload} className="text-sm font-semibold underline underline-offset-2">Retry loading partners</button></div>}

      {loading && partners.length === 0 ? (
        <SkeletonGrid label="Loading partners" kind="partner" count={8} />
      ) : error ? null : partners.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          No partners listed yet.
        </p>
      ) : (
        // No onEdit or onDelete, so the cards render with no action buttons at
        // all rather than buttons a visitor cannot use.
        <PartnerGrid partners={partners} />
      )}

      <PaginationControls currentPage={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}
