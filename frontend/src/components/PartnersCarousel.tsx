import type { PartnerResponse } from '../types/partner'
import { usePartners } from '../hooks/usePartners'
import Icon from './Icon'
import { useToastError } from '../hooks/useToast'

function LogoSet({ partners, decorative = false }: { partners: PartnerResponse[]; decorative?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center"
      role={decorative ? undefined : 'list'}
      aria-label={decorative ? undefined : 'Partner logos'}
      aria-hidden={decorative || undefined}
    >
      {partners.map((partner) => (
        <div key={partner.id} role={decorative ? undefined : 'listitem'} className="flex h-16 min-w-36 items-center justify-center px-6">
          {partner.logo_url ? (
            <img
              src={partner.logo_url}
              alt={decorative ? '' : `${partner.name} logo`}
              onError={(event) => { event.currentTarget.hidden = true }}
              loading="lazy"
              decoding="async"
              className="max-h-14 max-w-44 object-contain grayscale opacity-60 transition duration-300 group-hover:grayscale-0 group-hover:opacity-100"
            />
          ) : (
            <span className="flex items-center gap-2 text-gray-600 dark:text-[#b5b5b5]">
              <Icon name="domain" className="text-[22px]" />
              {!decorative && <span className="max-w-40 truncate text-sm font-medium">{partner.name}</span>}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function PartnersCarousel() {
  const { partners, loading, error, reload } = usePartners({ limit: 100 })
  useToastError(error)

  return (
    <section
      aria-label="Community partners"
      data-scroll-reveal
      className="scroll-reveal min-h-20 w-full border-t border-[#173c35]/10 py-3 dark:border-[#262626]"
    >
      {error && <p className="mx-auto max-w-[1160px] px-6 text-right text-sm"><button type="button" onClick={reload} className="font-semibold underline underline-offset-2">Retry loading partners</button></p>}

      {loading && partners.length === 0 ? (
        <p role="status" className="py-4 text-center text-sm text-gray-500 dark:text-[#8a8a8a]">Loading partners...</p>
      ) : partners.length === 0 ? (
        error ? null : <p className="py-4 text-center text-sm text-gray-500 dark:text-[#8a8a8a]">No partners listed yet.</p>
      ) : (
        <div className="partner-marquee group min-w-0 overflow-hidden">
          <div className="partner-marquee-track flex w-max">
            <LogoSet partners={partners} />
            <LogoSet partners={partners} decorative />
          </div>
        </div>
      )}
    </section>
  )
}
