import Card from '../Card'
import Icon from '../Icon'
import type { PartnerResponse } from '../../types/partner'

type PartnerCardProps = {
  partner: PartnerResponse
  /** Officials only. Omit both for the public grid, which has no actions. */
  onEdit?: () => void
  onDelete?: () => void
}

/**
 * One partner: a logo above a name.
 *
 * Not a link, unlike EventCard, PostCard and BlogCard. Those open a detail
 * page; a partner has none, because there is nothing on it a card does not
 * already show. Making it a link would promise somewhere to go.
 *
 * The officials' version gets edit and delete buttons through props rather
 * than through a separate component, because everything else about the two is
 * identical - and a second copy is how a public card and an admin card end up
 * looking subtly different.
 */
export default function PartnerCard({ partner, onEdit, onDelete }: PartnerCardProps) {
  const hasActions = Boolean(onEdit || onDelete)

  return (
    <Card className="group relative overflow-hidden">
      <div className="flex aspect-square w-full items-center justify-center border-b border-outline bg-surface-low p-8">
        {partner.logo_url ? (
          // object-contain so a wide logo is not cropped to fit a square.
          // Partner logos arrive in every aspect ratio there is.
          <img
            src={partner.logo_url}
            alt={`${partner.name} logo`}
            className="h-full w-full object-contain"
          />
        ) : (
          /*
            A partner with no logo yet - which, until R2 is configured, is
            every partner. Deliberately a plain placeholder rather than a
            broken image: logo_url is null both when nothing was uploaded and
            when there is nowhere to serve it from, and the card cannot tell
            those apart. Neither can a visitor, and neither needs to.
          */
          <div className="flex flex-col items-center gap-2 text-muted">
            <Icon name="domain" className="text-[32px]" />
            <span className="text-xs font-medium">No logo yet</span>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <h3 className="truncate text-sm font-semibold text-on-surface" title={partner.name}>
          {partner.name}
        </h3>
      </div>

      {hasActions && (
        // Absolutely positioned over the card rather than in its flow, so the
        // public grid and the officials' grid are the same shape and size.
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0">
          {onEdit && (
            <button
              type="button"
              aria-label={`Edit ${partner.name}`}
              onClick={onEdit}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            >
              <Icon name="edit" className="text-[16px]" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label={`Delete ${partner.name}`}
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            >
              <Icon name="delete" className="text-[16px]" />
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
