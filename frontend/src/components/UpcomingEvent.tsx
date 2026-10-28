import eventPhoto from '../assets/events/sonic-community-meetup.webp'

export default function UpcomingEvent() {
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
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-black sm:text-2xl">
          Upcoming events
        </h2>
        <article data-scroll-reveal className="scroll-reveal grid grid-cols-1 items-start gap-5 overflow-hidden transition-colors hover:bg-[#F7F8F7] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-8">
          <div className="relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden bg-[#f3e7dc]">
            <img
              src={eventPhoto}
              alt="Davao DeFi Community members gathered at a meetup"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col items-start justify-start gap-4 text-left sm:self-center">
            <h3 className="max-w-[680px] text-2xl font-semibold leading-tight tracking-tight text-black sm:text-3xl lg:text-4xl">
              {event.title}
            </h3>
            <p className="max-w-[680px] text-sm leading-relaxed text-gray-600 sm:text-base">
              {event.description}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">When</span>
                  <span className="mt-0.5 block text-sm font-medium text-gray-700 sm:text-base">{event.time}</span>
                </span>
              </div>
              <div>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">Where</span>
                  <span className="mt-0.5 block text-sm font-medium text-gray-700 sm:text-base">{event.location}</span>
                </span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
