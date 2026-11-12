import { useState, type ReactNode } from 'react'
import type { SnapshotImage } from '../services/landingSnapshot'

type LandingCardImageProps = {
  image: SnapshotImage | null
  alt: string
  sizes: string
  className: string
  fallback: ReactNode
}

export default function LandingCardImage({ image, alt, sizes, className, fallback }: LandingCardImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>()
  if (!image || image.src === failedSrc) return fallback

  return (
    <img
      src={image.src}
      srcSet={image.variants.length ? image.variants.map(({ url, width }) => `${url} ${width}w`).join(', ') : undefined}
      sizes={image.variants.length ? sizes : undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(image.src)}
      className={className}
    />
  )
}
