import { useEffect, useRef, useState } from 'react'
import meetupPhoto from '../assets/events/community-meetup-01.webp'
import workshopPhoto from '../assets/events/community-photo-05.webp'
import talksPhoto from '../assets/events/ict-con-community-event.webp'
import buildPhoto from '../assets/events/community-photo-04.webp'
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
  const stepsRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    const steps = stepsRef.current?.querySelectorAll<HTMLElement>('[data-what-we-do-step]')
    if (!section || !steps?.length) return

    if (window.matchMedia('(min-width: 1024px)').matches) {
      const updateActiveStep = () => {
        const scrollableDistance = section.offsetHeight - window.innerHeight
        const progress = scrollableDistance > 0
          ? clamp(-section.getBoundingClientRect().top / scrollableDistance, 0, 1)
          : 0
        setActiveIndex(Math.min(activities.length - 1, Math.floor(progress * activities.length)))
      }

      updateActiveStep()
      window.addEventListener('scroll', updateActiveStep, { passive: true })
      window.addEventListener('resize', updateActiveStep)
      return () => {
        window.removeEventListener('scroll', updateActiveStep)
        window.removeEventListener('resize', updateActiveStep)
      }
    }

    if (!('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveIndex(Number((entry.target as HTMLElement).dataset.whatWeDoStep))
          }
        })
      },
      { rootMargin: '-42% 0px -42% 0px', threshold: 0 },
    )

    steps.forEach((step) => observer.observe(step))
    return () => observer.disconnect()
  }, [])

  const activeActivity = activities[activeIndex]

  return (
    <section ref={sectionRef} aria-label="Community initiatives" className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:h-[180vh] lg:px-16 lg:py-0">
      <div className="mx-auto w-full max-w-[1160px] lg:sticky lg:top-0 lg:flex lg:min-h-screen lg:flex-col lg:justify-start lg:pt-8">
        <LandingStats compact />
        <div className="mt-16 grid gap-8 sm:mt-20 lg:mt-24 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
          <div ref={stepsRef} className="flex flex-col gap-2">
            {activities.map((activity, index) => {
              const isActive = activeIndex === index
              return (
                <button
                  key={activity.title}
                  type="button"
                  data-what-we-do-step={index}
                  aria-pressed={isActive}
                  onClick={() => setActiveIndex(index)}
                  className={`group relative flex w-full flex-col justify-center overflow-hidden px-5 text-left transition-[min-height,background-color,padding] duration-300 ease-out sm:px-7 ${isActive ? `min-h-[80px] ${index % 2 === 0 ? 'bg-[#F58C2F]' : 'bg-[#EE2F71]'} py-4` : 'min-h-[72px] bg-transparent py-3 hover:bg-white/70'}`}
                >
                  <span className="flex w-full items-center">
                    <span className={`text-base font-semibold transition-colors sm:text-lg ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-[#082923]'}`}>
                      {activity.title}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative flex min-h-[300px] items-end overflow-hidden bg-[#082923] sm:min-h-[360px] lg:min-h-[420px]">
            <img
              key={activeIndex}
              src={activeActivity.image}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ animation: 'what-we-do-enter 420ms ease both' }}
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
            <div key={activeIndex} className="relative max-w-xl p-6 sm:p-9 lg:p-10" style={{ animation: 'what-we-do-enter 360ms ease both' }}>
              <h3 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                {activeActivity.title}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-white/90 sm:text-lg lg:text-xl">
                {activeActivity.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
