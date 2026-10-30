import { useState } from 'react'

import eventPhoto from '../assets/events/sonic-community-meetup.webp'

export default function UpcomingEvent() {
  const [isActive, setIsActive] = useState(false)
  const event = {
    title: 'Davao DeFi Community Meetup',
    description: 'A community meetup bringing together local builders and Web3 enthusiasts to connect, share ideas, and explore DeFi in Mindanao.',
    time: 'Time to be announced',
    location: 'Davao City',
  }

  return (
    <section
      aria-label="Upcoming event"
      className="w-full"
    >
      <div className="w-full">
        <h2 data-scroll-reveal className="scroll-reveal mb-4 text-xl font-semibold tracking-tight text-black dark:text-[#f5f5f5] sm:text-2xl">
          Upcoming events
        </h2>
        <article
          data-scroll-reveal
          role="button"
          tabIndex={0}
          aria-pressed={isActive}
          onClick={() => setIsActive((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setIsActive((current) => !current)
            }
          }}
          className={`scroll-reveal grid w-full cursor-pointer grid-cols-1 items-start gap-5 overflow-hidden text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58C2F] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-8 ${isActive ? 'bg-[#F7F8F7] dark:bg-[#1a1a1a]' : 'bg-white hover:bg-[#F7F8F7] focus-visible:bg-[#F7F8F7] dark:bg-black dark:hover:bg-[#141414] dark:focus-visible:bg-[#141414]'}`}
        >
          <div className="relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden bg-[#f3e7dc]">
            <img
              src={eventPhoto}
              alt="Davao DeFi Community members gathered at a meetup"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col items-start justify-start gap-4 text-left sm:self-center">
            <h3 className="max-w-[680px] text-2xl font-semibold leading-tight tracking-tight text-black dark:text-[#f5f5f5] sm:text-3xl lg:text-4xl">
              {event.title}
            </h3>
            <p className="max-w-[680px] text-sm leading-relaxed text-gray-600 dark:text-[#b5b5b5] sm:text-base">
              {event.description}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]">When</span>
                  <span className="mt-0.5 block text-sm font-medium text-gray-700 dark:text-[#b5b5b5] sm:text-base">{event.time}</span>
                </span>
              </div>
              <div>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]">Where</span>
                  <span className="mt-0.5 block text-sm font-medium text-gray-700 dark:text-[#b5b5b5] sm:text-base">{event.location}</span>
                </span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
