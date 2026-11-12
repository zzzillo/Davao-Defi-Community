import Icon from '../Icon'
import { getSocialNetwork } from '../../utils/socialNetworks'

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
        const platform = getSocialNetwork(network)
        const label = platform?.label ?? network
        return (
          <a
            key={`${network}-${url}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${name} on ${label}`}
            title={label}
            className="text-muted transition-colors hover:text-on-surface"
          >
            {platform?.iconPath ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d={platform.iconPath} />
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
