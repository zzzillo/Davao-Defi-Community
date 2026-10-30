import avalancheLogo from '../assets/partners/avalanche.jpg'
import baseLogo from '../assets/partners/vector/base.svg'
import bitskwelaLogo from '../assets/partners/bitskwela.webp'
import cmuLogo from '../assets/partners/vector/cmu.svg'
import cmuFallback from '../assets/partners/cmu.png'
import devconLogo from '../assets/partners/vector/devcon.svg'
import devconFallback from '../assets/partners/devcon.png'
import dnscLogo from '../assets/partners/optimized/dnsc-logo.jpg'
import solanaLogo from '../assets/partners/solana.jpg'
import sonicLogo from '../assets/partners/sonic.jpg'
import stellarLogo from '../assets/partners/vector/stellar.svg'
import stellarFallback from '../assets/partners/stellar.png'
import stellarXLogo from '../assets/partners/stellarx.jpg'
import usepLogo from '../assets/partners/vector/usep.svg'
import usepFallback from '../assets/partners/usep.png'
import baseFallback from '../assets/partners/base.png'
import usmLogo from '../assets/partners/optimized/usm.png'

const partnerLogos: Array<{ name: string; src: string; fallback?: string }> = [
  { name: 'CMU', src: cmuLogo, fallback: cmuFallback },
  { name: 'StellarX', src: stellarXLogo },
  { name: 'University of Southern Mindanao', src: usmLogo },
  { name: 'Sonic', src: sonicLogo },
  { name: 'Avalanche', src: avalancheLogo },
  { name: 'Stellar', src: stellarLogo, fallback: stellarFallback },
  { name: 'Davao del Norte State College', src: dnscLogo },
  { name: 'University of Southeastern Philippines', src: usepLogo, fallback: usepFallback },
  { name: 'Solana', src: solanaLogo },
  { name: 'Bitskwela', src: bitskwelaLogo },
  { name: 'Devcon', src: devconLogo, fallback: devconFallback },
  { name: 'Base', src: baseLogo, fallback: baseFallback },
]

function LogoSet({ decorative = false }: { decorative?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center"
      role={decorative ? undefined : 'list'}
      aria-label={decorative ? undefined : 'Partner logos'}
      aria-hidden={decorative || undefined}
    >
      {partnerLogos.map((logo) => (
        <div key={logo.name} role={decorative ? undefined : 'listitem'} className="flex h-16 min-w-36 items-center justify-center px-6">
          <img
            src={logo.src}
            alt={decorative ? '' : `${logo.name} logo`}
            onError={(event) => {
              const image = event.currentTarget
              if (logo.fallback && image.dataset.fallbackApplied !== 'true') {
                image.dataset.fallbackApplied = 'true'
                image.src = logo.fallback
              } else {
                image.hidden = true
              }
            }}
            loading="lazy"
            decoding="async"
            className="max-h-14 max-w-44 object-contain grayscale opacity-60 transition duration-300 group-hover:grayscale-0 group-hover:opacity-100"
          />
        </div>
      ))}
    </div>
  )
}

export default function PartnersCarousel() {
  return (
    <section
      aria-label="Community partners"
      data-scroll-reveal
      className="scroll-reveal w-full border-t border-[#173c35]/10 py-3 dark:border-[#262626]"
    >
      <div className="partner-marquee group min-w-0 overflow-hidden">
        <div className="partner-marquee-track flex w-max">
          <LogoSet />
          <LogoSet decorative />
        </div>
      </div>
    </section>
  )
}
