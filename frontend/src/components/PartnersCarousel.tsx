import type { LandingSnapshot } from '../services/landingSnapshot'
import Icon from './Icon'
import LandingCardImage from './LandingCardImage'

type Partners = LandingSnapshot['partners']

function LogoSet({ partners, decorative = false }: { partners: Partners; decorative?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center"
      role={decorative ? undefined : 'list'}
      aria-label={decorative ? undefined : 'Partner logos'}
      aria-hidden={decorative || undefined}
    >
      {partners.map((partner) => (
        <div key={partner.id} role={decorative ? undefined : 'listitem'} className="flex h-14 min-w-40 shrink-0 items-center justify-center px-3 sm:h-16 sm:min-w-56 sm:px-6">
          <LandingCardImage
            image={partner.image}
            alt={decorative ? '' : `${partner.name} logo`}
            sizes="(min-width: 640px) 224px, 192px"
            className="h-12 w-auto max-w-48 object-contain grayscale opacity-60 transition duration-300 group-hover:grayscale-0 group-hover:opacity-100 sm:h-14 sm:max-w-56"
            fallback={(
              <span className="flex items-center gap-2 text-gray-600 dark:text-[#b5b5b5]">
                <Icon name="domain" className="text-[22px]" />
                <span className="max-w-40 truncate text-sm font-medium">{partner.name}</span>
              </span>
            )}
          />
        </div>
      ))}
    </div>
  )
}

export default function PartnersCarousel({ partners }: { partners: Partners }) {
  return (
    <section
      aria-label="Community partners"
      data-scroll-reveal
      className="scroll-reveal min-h-20 w-full border-t border-[#173c35]/10 py-3 dark:border-[#262626]"
    >
      {partners.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500 dark:text-[#8a8a8a]">No partners listed yet.</p>
      ) : (
        <div className="partner-marquee group min-w-0 overflow-hidden">
          <div
            className="partner-marquee-track flex w-max"
            style={{ animationDuration: `${partners.length * 3}s` }}
          >
            <LogoSet partners={partners} />
            <LogoSet partners={partners} decorative />
          </div>
        </div>
      )}
    </section>
  )
}
