import { Link } from 'react-router-dom'
import Icon from './Icon'
import LandingCardImage from './LandingCardImage'
import LandingSectionIntro from './LandingSectionIntro'
import type { LandingSnapshot } from '../services/landingSnapshot'
import { formatPostDate } from '../utils/post'

export default function PastEvents({ recaps }: Pick<LandingSnapshot, 'recaps'>) {
  return (
    <section aria-label="Published Events" className="w-full px-6 py-12 sm:px-10 sm:py-16 lg:px-16 lg:pb-24">
      <div className="mx-auto flex w-full max-w-[1160px] flex-col">
        <LandingSectionIntro
          title="Proof of work"
        />

        {recaps.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-[#8a8a8a]">No Events published yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {recaps.map((post, index) => (
              <Link
                key={post.id}
                to={`/events/${encodeURIComponent(post.id)}`}
                data-scroll-reveal
                className="scroll-reveal public-image-hover flex flex-col gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58C2F]"
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <div className="public-image-frame relative aspect-[16/9] w-full overflow-hidden bg-gray-100 text-gray-400 dark:bg-[#141414] dark:text-[#777]">
                  <LandingCardImage
                    image={post.image}
                    alt=""
                    sizes="(min-width: 640px) calc(50vw - 52px), calc(100vw - 48px)"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none"
                    fallback={(
                      <div className="flex h-full items-center justify-center">
                        <Icon name="photo_library" className="text-[32px]" />
                      </div>
                    )}
                  />
                </div>
                <div className="py-1">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-600 dark:text-[#8a8a8a]">
                    {formatPostDate(post.post_date)}
                  </p>
                  <h3 title={post.title} className="line-clamp-2 text-base font-semibold leading-snug text-black dark:text-[#f5f5f5] sm:text-lg">
                    {post.title}
                  </h3>
                  {post.location && (
                    <p className="mt-2 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-sm font-medium text-gray-700 dark:text-[#b5b5b5]">
                      <Icon name="location_on" className="shrink-0 text-[18px]" />
                      <span title={post.location} className="truncate">{post.location}</span>
                    </p>
                  )}
                  {post.description && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600 dark:text-[#b5b5b5]">{post.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Link
            to="/events"
            data-scroll-reveal
            className="group scroll-reveal inline-flex items-center gap-2 rounded-full py-2 text-sm font-semibold text-gray-800 transition-colors hover:text-[#EE2F71] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EE2F71] dark:text-[#f5f5f5] dark:hover:text-[#F58C2F] sm:text-base"
          >
            <span className="underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current group-focus-visible:decoration-current">All Events</span>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 10h12m-5-5 5 5-5 5" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
