import { useState } from 'react'

import blogImage1 from '../assets/events/optimized/community-photo-05.jpg'
import blogImage2 from '../assets/events/optimized/community-photo-03.jpg'
import blogImage3 from '../assets/events/optimized/community-photo-04.jpg'

const blogPlaceholders = [1, 2, 3]
const placeholderImages = [blogImage1, blogImage2, blogImage3]

export default function LandingBlogs() {
  const [activeBlog, setActiveBlog] = useState<number | null>(null)

  return (
    <section aria-label="Blog placeholders" className="w-full px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
      <div className="mx-auto w-full max-w-[1160px]">
        <h2 data-scroll-reveal className="scroll-reveal mb-5 text-xl font-semibold tracking-tight text-black dark:text-[#f5f5f5] sm:text-2xl">
          Check our contents
        </h2>
        <div className="flex flex-col gap-5">
          {blogPlaceholders.map((blog, index) => (
            <article
              key={blog}
              data-scroll-reveal
              role="button"
              tabIndex={0}
              aria-pressed={activeBlog === blog}
              onClick={() => setActiveBlog((current) => current === blog ? null : blog)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setActiveBlog((current) => current === blog ? null : blog)
                }
              }}
              className={`scroll-reveal grid w-full cursor-pointer grid-cols-1 overflow-hidden text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58C2F] sm:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] ${activeBlog === blog ? 'bg-[#F7F8F7] dark:bg-[#1a1a1a]' : 'bg-white hover:bg-[#F7F8F7] focus-visible:bg-[#F7F8F7] dark:bg-black dark:hover:bg-[#141414] dark:focus-visible:bg-[#141414]'}`}
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <div className="relative aspect-video w-full self-start overflow-hidden bg-gray-100">
                <img
                  src={placeholderImages[index]}
                  alt="Blog placeholder image"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-center p-4 sm:p-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-600 dark:text-[#8a8a8a]">
                  Date to be added
                </p>
                <h2 className="text-xl font-semibold leading-snug text-black dark:text-[#f5f5f5] sm:text-2xl">Blog title</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-[#b5b5b5] sm:text-base">
                  Add a short blog summary here.
                </p>
                <p className="mt-4 text-sm font-medium text-gray-700 dark:text-[#b5b5b5]">Author to be added</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <a
            href="/blogs"
            data-scroll-reveal
            className="scroll-reveal group inline-flex items-center gap-2 text-sm font-semibold text-gray-800 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:text-black active:-translate-y-0.5 active:text-black focus-visible:-translate-y-0.5 focus-visible:text-black dark:text-[#b5b5b5] dark:hover:text-white dark:active:text-white sm:text-base"
          >
            All blogs
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
