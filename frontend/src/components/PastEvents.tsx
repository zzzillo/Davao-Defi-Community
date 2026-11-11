import { Link } from 'react-router-dom'
import Icon from './Icon'
import { usePosts } from '../hooks/usePosts'
import { formatPostDate, postDisplayTitle } from '../utils/post'
import { stripHtml } from '../utils/event'
import { useToastError } from '../hooks/useToast'

export default function PastEvents() {
  const { posts, loading, error, reload } = usePosts({ limit: 4 })
  useToastError(error)

  return (
    <section aria-label="Published event recaps" className="w-full">
      <div className="flex w-full flex-col gap-4">
        <h2 data-scroll-reveal className="scroll-reveal text-xl font-semibold tracking-tight text-black dark:text-[#f5f5f5] sm:text-2xl">
          Proof of work
        </h2>

        {error && <div className="text-right"><button type="button" onClick={reload} className="text-sm font-semibold underline underline-offset-2">Retry loading recaps</button></div>}

        {loading && posts.length === 0 ? (
          <p role="status" className="py-10 text-center text-sm text-gray-500 dark:text-[#8a8a8a]">Loading published recaps...</p>
        ) : posts.length === 0 ? (
          error ? null : <p className="py-10 text-center text-sm text-gray-500 dark:text-[#8a8a8a]">No published recaps yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {posts.map((post, index) => {
              const imageUrl = post.images.find((candidate) => candidate.image_url)?.image_url
              const description = stripHtml(post.description)

              return (
                <Link
                  key={post.id}
                  to={`/recaps/${post.id}`}
                  data-scroll-reveal
                  className="scroll-reveal group flex flex-col gap-3 transition-colors hover:bg-[#F7F8F7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58C2F] dark:hover:bg-[#141414]"
                  style={{ transitionDelay: `${index * 90}ms` }}
                >
                  <div className="public-image-frame relative aspect-[16/9] w-full overflow-hidden bg-gray-100 text-gray-400 dark:bg-[#141414] dark:text-[#777]">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={(imageEvent) => { imageEvent.currentTarget.hidden = true }}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Icon name="photo_library" className="text-[32px]" />
                      </div>
                    )}
                  </div>
                  <div className="py-1">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-600 dark:text-[#8a8a8a]">
                      {formatPostDate(post.post_date)}
                    </p>
                    <h3 className="text-base font-semibold leading-snug text-black dark:text-[#f5f5f5] sm:text-lg">
                      {postDisplayTitle(post)}
                    </h3>
                    {post.location && (
                      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-[#b5b5b5]">
                        <Icon name="location_on" className="text-[18px]" />
                        {post.location}
                      </p>
                    )}
                    {description && (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600 dark:text-[#b5b5b5]">{description}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
