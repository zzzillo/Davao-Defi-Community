import type { SyntheticEvent } from 'react'
import type { ContributorResponse } from '../../types/contributor'

function contributorInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? '')
    .join('')
}

export default function ContributorAvatar({
  contributor,
  className = '',
  imageClassName = '',
  fill = false,
}: {
  contributor: ContributorResponse
  className?: string
  imageClassName?: string
  fill?: boolean
}) {
  const hideFailedImage = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.hidden = true
  }

  return (
    <div className={`${fill ? 'absolute inset-0' : 'relative'} flex items-center justify-center overflow-hidden bg-surface-low ${className}`}>
      <span aria-hidden="true" className="select-none text-4xl font-semibold tracking-wide text-muted">
        {contributorInitials(contributor.display_name)}
      </span>
      {contributor.profile_photo_url && (
        <img
          src={contributor.profile_photo_url}
          alt={`Profile photo of ${contributor.display_name}`}
          loading="lazy"
          decoding="async"
          onError={hideFailedImage}
          className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`}
        />
      )}
    </div>
  )
}
