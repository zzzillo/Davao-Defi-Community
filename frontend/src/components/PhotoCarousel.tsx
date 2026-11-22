import { useEffect, useLayoutEffect, useRef, useState, type TransitionEvent } from 'react'

import LandingImage from './LandingImage'
import {
  communityMeetup01, communityPhoto03 as fallbackCommunityPhoto,
  campusCommunityEvent, mindanaoSummitAward, northCommunityEvent,
  sonicCommunityMeetup, team1WomenAvax, communityPhoto07, communityPhoto12,
} from '../data/landingImages'

// Alt text describes what is in each photo, for screen readers and image search.
const photos = [
  { image: communityMeetup01, alt: 'Davao DeFi Community members gathered around a long table at an evening meetup' },
  { image: campusCommunityEvent, alt: 'Students and community members filling a hall for a campus Web3 event' },
  { image: mindanaoSummitAward, alt: 'The Davao DeFi Community team on stage receiving the Tech Community Impact Award at DEVCON Mindanao Summit 2024' },
  { image: northCommunityEvent, alt: 'Group photo of attendees in a hall after a community workshop' },
  { image: sonicCommunityMeetup, alt: 'Attendees of a Sonic community meetup posing together in a chandelier-lit ballroom' },
  { image: communityPhoto07, alt: 'Meetup attendees wearing paper bags with drawn faces during a community game' },
  { image: team1WomenAvax, alt: 'Team1 Women of Avax members posing together outdoors at Cafe Verdania' },
  { image: communityPhoto12, alt: 'Participants holding Avalanche and Team1 banners at an outdoor Sundown Avalanche event' },
]

function PhotoSet({ decorative = false }: { decorative?: boolean }) {
  return (
    <div
      className="flex shrink-0"
      role={decorative ? undefined : 'list'}
      aria-label={decorative ? undefined : 'Davao DeFi Community photos'}
      aria-hidden={decorative || undefined}
    >
      {photos.map(({ image, alt }, index) => (
        <figure
          key={`${decorative ? 'duplicate-' : ''}${index}`}
          role={decorative ? undefined : 'listitem'}
          className="m-0 h-[220px] w-[320px] shrink-0 overflow-hidden sm:h-[260px] sm:w-[380px] lg:h-[300px] lg:w-[440px]"
        >
          <LandingImage
            image={image}
            sizes={`(min-width: 1024px) ${Math.ceil(Math.max(440, 300 * image.width / image.height))}px, (min-width: 640px) ${Math.ceil(Math.max(380, 260 * image.width / image.height))}px, ${Math.ceil(Math.max(320, 220 * image.width / image.height))}px`}
            alt={decorative ? '' : alt}
            onError={(event) => {
              const image = event.currentTarget
              if (image.dataset.fallbackApplied !== 'true') {
                image.dataset.fallbackApplied = 'true'
                image.srcset = ''
                image.src = fallbackCommunityPhoto.src
              } else {
                image.hidden = true
              }
            }}
            loading={!decorative && index === 0 ? 'eager' : 'lazy'}
            fetchPriority={!decorative && index === 0 ? 'high' : 'auto'}
            decoding="async"
            draggable={false}
            className="block h-full w-full object-cover"
          />
        </figure>
      ))}
    </div>
  )
}

export default function PhotoCarousel() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [sizes, setSizes] = useState({ viewport: 0, photo: 0 })
  const [index, setIndex] = useState(0)
  const [snapToStart, setSnapToStart] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(true)

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting))
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const firstPhoto = trackRef.current?.querySelector('figure')
    if (!viewport || !firstPhoto) return

    const measure = () => {
      const nextSizes = {
        viewport: viewport.getBoundingClientRect().width,
        photo: firstPhoto.getBoundingClientRect().width,
      }
      setSizes((current) =>
        current.viewport === nextSizes.viewport && current.photo === nextSizes.photo
          ? current
          : nextSizes,
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(firstPhoto)
    measure()

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible || !isPageVisible || index >= photos.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timeout = window.setTimeout(() => setIndex((current) => current + 1), 3000)
    return () => window.clearTimeout(timeout)
  }, [index, isPageVisible, isVisible])

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform' || index !== photos.length) return

    setSnapToStart(true)
    setIndex(0)
    requestAnimationFrame(() => requestAnimationFrame(() => setSnapToStart(false)))
  }

  const centerOffset = Math.max(0, (sizes.viewport - sizes.photo) / 2)
  const photoSetWidth = sizes.photo * photos.length

  return (
    <section aria-label="Community photos" data-scroll-reveal className="scroll-reveal w-full overflow-hidden">
      <div ref={viewportRef} className="overflow-hidden">
        <div
          ref={trackRef}
          className="flex w-max will-change-transform"
          style={{
            transform: `translateX(${-photoSetWidth + centerOffset - index * sizes.photo}px)`,
            transition: snapToStart || sizes.photo === 0 ? 'none' : 'transform 1400ms ease-in-out',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          <PhotoSet decorative />
          <PhotoSet />
          <PhotoSet decorative />
        </div>
      </div>
    </section>
  )
}

