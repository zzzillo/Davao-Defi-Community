import { useEffect, useRef, useState } from 'react'
import meetupPhoto from '../assets/events/community-meetup-01.webp'
import workshopPhoto from '../assets/events/optimized/community-photo-05.jpg'
import talksPhoto from '../assets/events/ict-con-community-event.webp'
import buildPhoto from '../assets/events/optimized/community-photo-04.jpg'
import storiesPhoto from '../assets/events/mindanao-summit-2024-award.webp'
import LandingStats from './LandingStats'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const activities = [
  {
    title: 'Meetups',
    description: 'We bring the community together to meet, share ideas, and make connections.',
    image: meetupPhoto,
  },
  {
    title: 'Workshops',
    description: 'We host practical, beginner-friendly sessions on blockchain, DeFi, and Web3.',
    image: workshopPhoto,
  },
  {
    title: 'Talks & Panels',
    description: 'We invite community members and guest speakers to share their ideas and experiences.',
    image: talksPhoto,
  },
  {
    title: 'Build Sessions',
    description: 'We create opportunities for people to work on Web3 ideas and projects together.',
    image: buildPhoto,
  },
  {
    title: 'Community Stories & Resources',
    description: 'We share community updates, event highlights, and useful resources to help people keep learning.',
    image: storiesPhoto,
  },
]

export default function LandingWhatWeDo() {
  const sectionRef = useRef<HTMLElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || !window.matchMedia('(min-width: 1024px)').matches) return

    const updateActiveStep = () => {
      const scrollableDistance = section.offsetHeight - window.innerHeight
      const progress = scrollableDistance > 0
        ? clamp(-section.getBoundingClientRect().top / scrollableDistance, 0, 1)
        : 0
      const nextIndex = Math.min(activities.length - 1, Math.floor(progress * activities.length))
      setActiveIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex)
    }

    updateActiveStep()
    window.addEventListener('scroll', updateActiveStep, { passive: true })
    window.addEventListener('resize', updateActiveStep)
    return () => {
      window.removeEventListener('scroll', updateActiveStep)
      window.removeEventListener('resize', updateActiveStep)
    }
  }, [])

  const activeActivity = activities[activeIndex]

  return (
    <section ref={sectionRef} aria-label="Community initiatives" className="w-full px-6 pt-4 pb-8 sm:px-10 sm:pt-8 sm:pb-10 lg:h-[180vh] lg:px-16 lg:py-0">
      <div className="mx-auto flex w-full max-w-[1160px] flex-col justify-start lg:sticky lg:top-0 lg:min-h-screen lg:pt-8">
        <LandingStats compact />
        <div className="mx-auto mt-4 w-full max-w-[1160px] sm:mt-5 lg:mt-6 lg:flex lg:flex-1 lg:flex-col lg:justify-start">
          <h2 data-scroll-reveal className="scroll-reveal mb-4 text-xl font-semibold tracking-tight text-black dark:text-[#f5f5f5] sm:text-2xl">
            Our initiatives
          </h2>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_575px] lg:gap-8 xl:grid-cols-[460px_575px] xl:justify-between xl:gap-0">
            <div data-scroll-reveal className="scroll-reveal order-1 relative flex h-[clamp(140px,25svh,220px)] items-end overflow-hidden bg-[#082923] min-[400px]:h-[clamp(180px,30svh,280px)] sm:h-[clamp(280px,42svh,460px)] lg:order-2 lg:h-[420px] lg:min-h-0 lg:w-[575px] lg:flex-none">
              <img
                key={`initiative-image-${activeIndex}`}
                src={activeActivity.image}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ animation: 'what-we-do-enter 420ms ease both' }}
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
              <div key={`initiative-copy-${activeIndex}`} className="relative max-w-xl p-5 sm:p-7 lg:p-10" style={{ animation: 'what-we-do-enter 360ms ease both' }}>
                <h3 className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl lg:text-5xl">
                  {activeActivity.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/90 sm:mt-3 sm:text-base lg:mt-4 lg:text-xl">
                  {activeActivity.description}
                </p>
              </div>
            </div>

            <div className="order-2 flex flex-col gap-1.5 lg:order-1 lg:gap-2">
              {activities.map((activity, index) => {
                const isActive = activeIndex === index
                const activeColor = index % 2 === 0 ? 'bg-[#F58C2F]' : 'bg-[#EE2F71]'
                return (
                  <button
                    key={activity.title}
                    type="button"
                    data-scroll-reveal
                    aria-pressed={isActive}
                    onClick={() => setActiveIndex(index)}
                    className={`scroll-reveal group relative flex w-full flex-col justify-center overflow-hidden px-4 text-left transition-[min-height,background-color,padding] duration-300 ease-out sm:px-6 lg:px-7 ${isActive ? `min-h-[44px] sm:min-h-[52px] lg:min-h-[80px] ${activeColor} py-2 sm:py-3 lg:py-4` : 'min-h-[36px] bg-transparent py-1 hover:bg-[#F7F8F7] focus-visible:bg-[#F7F8F7] dark:bg-[#141414] dark:hover:bg-[#222222] dark:focus-visible:bg-[#222222] sm:min-h-[44px] sm:py-2 lg:min-h-[72px] lg:py-3'}`}
                  >
                    <span className="flex w-full items-center">
                      <span className={`text-sm font-semibold transition-colors sm:text-base lg:text-lg ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-[#082923] dark:text-[#b5b5b5] dark:group-hover:text-white'}`}>
                        {activity.title}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
