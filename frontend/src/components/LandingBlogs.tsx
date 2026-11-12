import { Link } from 'react-router-dom'
import Icon from './Icon'
import LandingCardImage from './LandingCardImage'
import type { LandingSnapshot } from '../services/landingSnapshot'
import { formatPublishedDate } from '../utils/blog'

export default function LandingBlogs({ articles }: Pick<LandingSnapshot, 'articles'>) {
  return (
    <section aria-label="Latest articles" className="w-full px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
      <div className="mx-auto w-full max-w-[1160px]">
        <h2 data-scroll-reveal className="scroll-reveal mb-5 text-xl font-semibold tracking-tight text-black dark:text-[#f5f5f5] sm:text-2xl">
          Check our contents
        </h2>

        {articles.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-[#8a8a8a]">Nothing published yet. Check back soon.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {articles.map((blog, index) => (
              <Link
                key={blog.id}
                to={`/blog/${encodeURIComponent(blog.slug)}`}
                data-scroll-reveal
                className="scroll-reveal group grid grid-cols-1 overflow-hidden text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58C2F] sm:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]"
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <div className="relative aspect-video w-full overflow-hidden bg-gray-100 text-gray-400 dark:bg-[#141414] dark:text-[#777] sm:aspect-auto">
                  <LandingCardImage
                    image={blog.image}
                    alt=""
                    sizes="(min-width: 1024px) 280px, (min-width: 640px) 240px, calc(100vw - 48px)"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    fallback={(
                      <div className="flex h-full min-h-32 items-center justify-center">
                        <Icon name="article" className="text-[30px]" />
                      </div>
                    )}
                  />
                </div>
                <div className="flex flex-col justify-center p-4 sm:p-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-600 dark:text-[#8a8a8a]">
                    {blog.published_at
                      ? `Published ${formatPublishedDate(blog.published_at)}`
                      : blog.updated_at && `Last edited ${formatPublishedDate(blog.updated_at)}`}
                  </p>
                  <h3 className="text-xl font-semibold leading-snug text-black dark:text-[#f5f5f5] sm:text-2xl">{blog.title}</h3>
                  {blog.excerpt && (
                    <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-[#b5b5b5] sm:text-base">
                      {blog.excerpt}
                    </p>
                  )}
                  {blog.author && (
                    <p className="mt-4 text-sm font-medium text-gray-700 dark:text-[#b5b5b5]">{blog.author}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Link
            to="/blogs"
            data-scroll-reveal
            className="scroll-reveal group inline-flex items-center gap-2 text-sm font-semibold text-gray-800 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:text-black active:-translate-y-0.5 active:text-black focus-visible:-translate-y-0.5 focus-visible:text-black dark:text-[#b5b5b5] dark:hover:text-white dark:active:text-white sm:text-base"
          >
            <span className="relative after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 after:ease-out group-hover:after:scale-x-100 group-active:after:scale-x-100 group-focus-visible:after:scale-x-100">
              All blogs
            </span>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-active:translate-x-1 group-focus-visible:translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 10h12m-5-5 5 5-5 5" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
