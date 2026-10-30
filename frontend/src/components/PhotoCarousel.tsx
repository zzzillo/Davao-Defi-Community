import { useEffect, useLayoutEffect, useRef, useState, type TransitionEvent } from 'react'

import communityMeetup01 from '../assets/events/community-meetup-01.webp'
import fallbackCommunityPhoto from '../assets/events/community-photo-03.webp'
import campusCommunityEvent from '../assets/events/optimized/campus-community-event.jpg'
import mindanaoSummitAward from '../assets/events/mindanao-summit-2024-award.webp'
import northCommunityEvent from '../assets/events/optimized/north-community-event.jpg'
import sonicCommunityMeetup from '../assets/events/sonic-community-meetup.webp'
import team1WomenAvax from '../assets/events/optimized/team1-women-avax.jpg'
import communityPhoto07 from '../assets/events/community-photo-07.webp'
import communityPhoto12 from '../assets/events/optimized/community-photo-12.jpg'

const photos = [
  communityMeetup01,
  campusCommunityEvent,
  mindanaoSummitAward,
  northCommunityEvent,
  sonicCommunityMeetup,
  communityPhoto07,
  team1WomenAvax,
  communityPhoto12,
]

function PhotoSet({ decorative = false }: { decorative?: boolean }) {
  return (
    <div
      className="flex shrink-0"
      role={decorative ? undefined : 'list'}
      aria-label={decorative ? undefined : 'Davao DeFi Community photos'}
      aria-hidden={decorative || undefined}
    >
      {photos.map((src, index) => (
        <figure
          key={`${decorative ? 'duplicate-' : ''}${index}`}
          role={decorative ? undefined : 'listitem'}
          className="m-0 h-[220px] w-[320px] shrink-0 overflow-hidden sm:h-[260px] sm:w-[380px] lg:h-[300px] lg:w-[440px]"
        >
          <img
            src={src}
            alt={decorative ? '' : `Davao DeFi Community event photo ${index + 1}`}
            onError={(event) => {
              const image = event.currentTarget
              if (image.dataset.fallbackApplied !== 'true') {
                image.dataset.fallbackApplied = 'true'
                image.src = fallbackCommunityPhoto
              } else {
                image.hidden = true
              }
            }}
            loading="lazy"
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
  const [isPageVisible, setIsPageVisible] = useState(() => !document.hidden)

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

