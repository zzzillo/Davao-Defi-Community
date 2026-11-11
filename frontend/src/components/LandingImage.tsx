import type { ComponentProps } from 'react'

type LandingImageProps = Omit<ComponentProps<'img'>, 'src' | 'srcSet' | 'width' | 'height'> & {
  image: { src: string; srcSet: string; width: number; height: number }
  sizes: string
}

/** Responsive sources with intrinsic dimensions for the static landing photos. */
export default function LandingImage({ image, ...props }: LandingImageProps) {
  return <img loading="lazy" decoding="async" {...image} {...props} />
}
