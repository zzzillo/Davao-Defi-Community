import { Link } from 'react-router-dom'
import Icon from './Icon'
import LandingCardImage from './LandingCardImage'
import type { LandingSnapshot } from '../services/landingSnapshot'
import { formatPostDate } from '../utils/post'

export default function PastEvents({ recaps }: Pick<LandingSnapshot, 'recaps'>) {
  return (
    <section aria-label="Published event recaps" className="w-full">
      <div className="flex w-full flex-col gap-4">
        <h2 data-scroll-reveal className="scroll-reveal text-xl font-semibold tracking-tight text-black dark:text-[#f5f5f5] sm:text-2xl">
          Proof of work
        </h2>

        {recaps.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-[#8a8a8a]">No published recaps yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {recaps.map((post, index) => (
              <Link
                key={post.id}
                to={`/recaps/${encodeURIComponent(post.id)}`}
                data-scroll-reveal
                className="scroll-reveal group flex flex-col gap-3 transition-colors hover:bg-[#F7F8F7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58C2F] dark:hover:bg-[#141414]"
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <div className="public-image-frame relative aspect-[16/9] w-full overflow-hidden bg-gray-100 text-gray-400 dark:bg-[#141414] dark:text-[#777]">
                  <LandingCardImage
                    image={post.image}
                    alt=""
                    sizes="(min-width: 1280px) 272px, (min-width: 1024px) calc(50vw - 76px), (min-width: 768px) calc(50vw - 52px), (min-width: 640px) calc(100vw - 80px), calc(100vw - 48px)"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
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
                  <h3 className="text-base font-semibold leading-snug text-black dark:text-[#f5f5f5] sm:text-lg">
                    {post.title}
                  </h3>
                  {post.location && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-[#b5b5b5]">
                      <Icon name="location_on" className="text-[18px]" />
                      {post.location}
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
      </div>
    </section>
  )
}
