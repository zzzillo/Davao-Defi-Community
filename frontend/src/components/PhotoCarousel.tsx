import { useEffect, useRef, useState, type TransitionEvent } from 'react'

import communityMeetup01 from '../assets/events/community-meetup-01.webp'
import communityPhoto02 from '../assets/events/community-photo-02.webp'
import campusCommunityEvent from '../assets/events/campus-community-event.webp'
import mindanaoSummitAward from '../assets/events/mindanao-summit-2024-award.webp'
import communityPhoto03 from '../assets/events/community-photo-03.webp'
import communityPhoto04 from '../assets/events/community-photo-04.webp'
import communityPhoto05 from '../assets/events/community-photo-05.webp'
import northCommunityEvent from '../assets/events/north-community-event.webp'
import sonicCommunityMeetup from '../assets/events/sonic-community-meetup.webp'
import upCommunityEvent from '../assets/events/up-community-event.webp'
import communityMeetup02 from '../assets/events/community-meetup-02.webp'
import communityPhoto06 from '../assets/events/community-photo-06.webp'
import communityPhoto07 from '../assets/events/community-photo-07.webp'
import ictConCommunityEvent from '../assets/events/ict-con-community-event.webp'
import communityPhoto08 from '../assets/events/community-photo-08.webp'
import communityPhoto09 from '../assets/events/community-photo-09.webp'
import communityPhoto10 from '../assets/events/community-photo-10.webp'
import team1WomenAvax from '../assets/events/team1-women-avax.webp'
import communityPhoto11 from '../assets/events/community-photo-11.webp'
import communityPhoto12 from '../assets/events/community-photo-12.webp'
import communityPhoto13 from '../assets/events/community-photo-13.webp'
import communityPhoto14 from '../assets/events/community-photo-14.webp'
import communityPhoto15 from '../assets/events/community-photo-15.webp'

const photos = [
  communityMeetup01,
  communityPhoto02,
  campusCommunityEvent,
  mindanaoSummitAward,
  communityPhoto03,
  communityPhoto04,
  communityPhoto05,
  northCommunityEvent,
  sonicCommunityMeetup,
  upCommunityEvent,
  communityMeetup02,
  communityPhoto06,
  communityPhoto07,
  ictConCommunityEvent,
  communityPhoto08,
  communityPhoto09,
  communityPhoto10,
  team1WomenAvax,
  communityPhoto11,
  communityPhoto12,
  communityPhoto13,
  communityPhoto14,
  communityPhoto15,
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
  const [index, setIndex] = useState(photos.length)
  const [snapToStart, setSnapToStart] = useState(false)

  useEffect(() => {
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
    if (index >= photos.length * 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timeout = window.setTimeout(() => setIndex((current) => current + 1), 3000)
    return () => window.clearTimeout(timeout)
  }, [index])

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform' || index !== photos.length * 2) return

    setSnapToStart(true)
    setIndex(photos.length)
    requestAnimationFrame(() => requestAnimationFrame(() => setSnapToStart(false)))
  }

  const centerOffset = Math.max(0, (sizes.viewport - sizes.photo) / 2)

  return (
    <section aria-label="Community photos" data-scroll-reveal className="scroll-reveal w-full overflow-hidden">
      <div ref={viewportRef} className="overflow-hidden">
        <div
          ref={trackRef}
          className="flex w-max will-change-transform"
          style={{
            transform: `translateX(${centerOffset - index * sizes.photo}px)`,
            transition: snapToStart ? 'none' : 'transform 1400ms ease-in-out',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          <PhotoSet />
          <PhotoSet decorative />
          <PhotoSet decorative />
        </div>
      </div>
    </section>
  )
}

