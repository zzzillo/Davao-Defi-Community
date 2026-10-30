import PastEvents from './PastEvents'
import UpcomingEvent from './UpcomingEvent'

export default function LandingEvents() {
  return (
    <section aria-label="Community events" className="w-full px-6 sm:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-[1160px] py-8 sm:py-10">
        <div className="grid gap-12">
          <UpcomingEvent />
          <PastEvents />
        </div>
        <div className="mt-5 flex justify-end">
          <a
            href="/recaps"
            data-scroll-reveal
            className="scroll-reveal group inline-flex items-center gap-2 text-sm font-semibold text-gray-800 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:text-black active:-translate-y-0.5 active:text-black focus-visible:-translate-y-0.5 focus-visible:text-black dark:text-[#b5b5b5] dark:hover:text-white dark:active:text-white sm:text-base"
          >
            All recaps
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-active:translate-x-1 group-focus-visible:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.5 10h12m-5-5 5 5-5 5" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
