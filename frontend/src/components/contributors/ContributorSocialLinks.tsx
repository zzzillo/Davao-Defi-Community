import { siDiscord, siGithub, siInstagram, siTelegram, siX } from 'simple-icons'
import Icon from '../Icon'

const iconPaths: Record<string, string> = {
  discord: siDiscord.path,
  github: siGithub.path,
  instagram: siInstagram.path,
  telegram: siTelegram.path,
  x: siX.path,
}

function networkIcon(name: string): string | null {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const key = normalized === 'twitter' ? 'x' : normalized
  return iconPaths[key] ?? null
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export default function ContributorSocialLinks({
  name,
  links,
  className = '',
}: {
  name: string
  links: Record<string, string>
  className?: string
}) {
  const safeLinks = Object.entries(links)
    .map(([network, value]) => ({ network, url: safeHttpUrl(value) }))
    .filter((link): link is { network: string; url: string } => Boolean(link.url))

  if (safeLinks.length === 0) return null

  return (
    <nav aria-label={`${name} social links`} className={`flex items-center gap-3 ${className}`}>
      {safeLinks.map(({ network, url }) => {
        const path = networkIcon(network)
        return (
          <a
            key={`${network}-${url}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${name} on ${network}`}
            title={network}
            className="text-muted transition-colors hover:text-on-surface"
          >
            {path ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d={path} />
              </svg>
            ) : (
              <Icon name="link" className="text-[20px]" />
            )}
          </a>
        )
      })}
    </nav>
  )
}
