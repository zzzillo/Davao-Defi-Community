import PartnerCard from './PartnerCard'
import type { PartnerResponse } from '../../types/partner'

type PartnerGridProps = {
  partners: PartnerResponse[]
  /** Officials only. Omit both for the public grid, which has no actions. */
  onEdit?: (partner: PartnerResponse) => void
  onDelete?: (partner: PartnerResponse) => void
}

/**
 * The responsive grid both partner pages render.
 *
 * A component rather than a repeated className, because the public page and
 * the officials' page must lay out identically - the officials' grid is a
 * preview of what visitors see, and it stops being one the moment somebody
 * changes the column count on one page and not the other.
 *
 * Two columns on a phone rather than one. Logos are square and small; a single
 * column would make each one enormous and the wall endless.
 */
export default function PartnerGrid({ partners, onEdit, onDelete }: PartnerGridProps) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
      {partners.map((partner) => (
        <PartnerCard
          key={partner.id}
          partner={partner}
          // Passed through only when the caller supplied one, so the public
          // grid renders cards with no action buttons at all rather than
          // buttons that do nothing.
          onEdit={onEdit && (() => onEdit(partner))}
          onDelete={onDelete && (() => onDelete(partner))}
        />
      ))}
    </div>
  )
}
