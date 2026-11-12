import { useEffect, useState } from 'react'
import PartnerCard from './PartnerCard'
import type { PartnerResponse } from '../../types/partner'

type PartnerGridProps = {
  partners: PartnerResponse[]
  /** Officials only. Omit both for the public grid, which has no actions. */
  onEdit?: (partner: PartnerResponse) => void
  onDelete?: (partner: PartnerResponse) => void
  /** Officials only. Saves a reordered sequence of the currently visible cards. */
  onReorder?: (partners: PartnerResponse[]) => Promise<void>
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
export default function PartnerGrid({ partners, onEdit, onDelete, onReorder }: PartnerGridProps) {
  const [displayPartners, setDisplayPartners] = useState(partners)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => setDisplayPartners(partners), [partners])

  async function movePartner(targetId: string) {
    if (!onReorder || !draggedId || draggedId === targetId) return
    const from = displayPartners.findIndex((partner) => partner.id === draggedId)
    const to = displayPartners.findIndex((partner) => partner.id === targetId)
    if (from < 0 || to < 0) return

    const reordered = [...displayPartners]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setDisplayPartners(reordered)
    setDraggedId(null)

    try {
      await onReorder(reordered)
    } catch {
      setDisplayPartners(partners)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
      {displayPartners.map((partner) => (
        <div
          key={partner.id}
          draggable={Boolean(onReorder)}
          onDragStart={(event) => {
            if (!onReorder || (event.target as HTMLElement).closest('button')) {
              event.preventDefault()
              return
            }
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', partner.id)
            setDraggedId(partner.id)
          }}
          onDragOver={(event) => {
            if (!onReorder || !draggedId) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(event) => {
            event.preventDefault()
            void movePartner(partner.id)
          }}
          onDragEnd={() => setDraggedId(null)}
          className={onReorder ? `cursor-grab active:cursor-grabbing ${draggedId === partner.id ? 'opacity-40' : ''}` : undefined}
          title={onReorder ? `Drag to move ${partner.name}` : undefined}
        >
          <PartnerCard
            partner={partner}
            onEdit={onEdit && (() => onEdit(partner))}
            onDelete={onDelete && (() => onDelete(partner))}
          />
        </div>
      ))}
    </div>
  )
}
