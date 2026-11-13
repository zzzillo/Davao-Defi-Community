import { Link } from 'react-router-dom'
import Icon from './Icon'
import LandingCardImage from './LandingCardImage'
import LandingSectionIntro from './LandingSectionIntro'
import type { LandingSnapshot } from '../services/landingSnapshot'
import { formatEventDay, formatEventTimeRange, stripHtml } from '../utils/event'

export default function UpcomingEvent({ event }: Pick<LandingSnapshot, 'event'>) {
  if (!event || event.kind !== 'upcoming') return null
  const description = stripHtml(event.description)

  return (
    <section aria-label="Upcoming RSVP" className="w-full px-6 py-12 sm:px-10 sm:py-16 lg:px-16 lg:pb-24">
      <div className="mx-auto w-full max-w-[1160px]">
        <LandingSectionIntro
          title="Upcoming RSVP"
        />

        <Link
            to={`/rsvp/${encodeURIComponent(event.id)}`}
            data-scroll-reveal
            className="scroll-reveal group grid w-full grid-cols-1 items-start gap-5 overflow-hidden text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58C2F] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-8"
          >
            <div className="relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden bg-[#f3e7dc] dark:bg-[#141414]">
              <LandingCardImage
                image={event.image}
                alt=""
                sizes="(min-width: 1160px) 440px, (min-width: 640px) 38vw, (min-width: 488px) 440px, calc(100vw - 48px)"
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                fallback={(
                  <div className="flex h-full items-center justify-center text-gray-500 dark:text-[#777]">
                    <Icon name="event" className="text-[44px]" />
                  </div>
                )}
              />
            </div>

            <div className="flex flex-col items-start justify-start gap-4 text-left sm:self-center">
              <h3 className="max-w-[680px] text-2xl font-semibold leading-tight tracking-tight text-black dark:text-[#f5f5f5] sm:text-3xl lg:text-4xl">
                {event.title}
              </h3>
              {description && (
                <p className="line-clamp-4 max-w-[680px] text-sm leading-relaxed text-gray-600 dark:text-[#b5b5b5] sm:text-base">
                  {description}
                </p>
              )}
              <div className="flex flex-col gap-4">
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]">When</span>
                  <span className="mt-0.5 block text-sm font-medium text-gray-700 dark:text-[#b5b5b5] sm:text-base">
                    {formatEventDay(event.start_datetime)} · {formatEventTimeRange(event)}
                  </span>
                </div>
                {event.location && (
                  <div>
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-[#8a8a8a]">Where</span>
                    <span className="mt-0.5 block text-sm font-medium text-gray-700 dark:text-[#b5b5b5] sm:text-base">{event.location}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
      </div>
    </section>
  )
}
