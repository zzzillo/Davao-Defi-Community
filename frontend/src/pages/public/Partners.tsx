import PartnerGrid from '../../components/partners/PartnerGrid'
import { usePartners } from '../../hooks/usePartners'

/**
 * The public partners wall.
 *
 * The simplest page on the public site, and deliberately so: no search, no
 * pager, no filters. A visitor wants to see who works with the community, and
 * that is one glance at a grid.
 *
 * No token and no permission - GET /partners takes no auth dependency at all,
 * unlike the other three public lists, because partners have no draft state
 * for one to guard.
 */
export default function PublicPartners() {
  // The shared cap. Ordering is alphabetical and comes from the server, so
  // nothing here sorts. Past a hundred partners this needs a pager, which is
  // the same six lines the public posts page already has.
  const { partners, loading, error } = usePartners({ limit: 100 })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Partners</h1>
        <p className="text-on-surface-variant">
          The organizations building alongside the Davao DeFi Community.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
          {error.message}
        </p>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-muted">Loading partners...</p>
      ) : partners.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          No partners listed yet.
        </p>
      ) : (
        // No onEdit or onDelete, so the cards render with no action buttons at
        // all rather than buttons a visitor cannot use.
        <PartnerGrid partners={partners} />
      )}
    </div>
  )
}
