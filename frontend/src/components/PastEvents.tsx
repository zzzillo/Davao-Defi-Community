import eventImage1 from '../assets/events/community-meetup-01.webp'
import eventImage2 from '../assets/events/community-photo-03.webp'
import eventImage3 from '../assets/events/community-photo-04.webp'
import eventImage4 from '../assets/events/community-photo-10.webp'

const pastEventPlaceholders = [1, 2, 3, 4]
const placeholderImages = [eventImage1, eventImage2, eventImage3, eventImage4]

export default function PastEvents() {
  return (
    <section aria-label="Proof of work" className="w-full">
      <div className="flex w-full flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-black sm:text-2xl">
          Proof of work
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {pastEventPlaceholders.map((event, index) => (
            <article
              key={event}
              data-scroll-reveal
              className="scroll-reveal flex flex-col gap-3"
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <div className="aspect-[16/9] w-full overflow-hidden">
                <img
                  src={placeholderImages[index]}
                  alt="Past event placeholder"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="py-1">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-600">
                  Date to be added
                </p>
                <h3 className="text-base font-semibold leading-snug text-black sm:text-lg">Past event title</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">Add a short event description here.</p>
                <p className="mt-2 text-sm font-medium text-gray-700">Location to be added</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
