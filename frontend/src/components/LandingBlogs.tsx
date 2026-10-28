import blogImage1 from '../assets/events/community-photo-05.webp'
import blogImage2 from '../assets/events/community-photo-03.webp'
import blogImage3 from '../assets/events/community-photo-04.webp'

const blogPlaceholders = [1, 2, 3]
const placeholderImages = [blogImage1, blogImage2, blogImage3]

export default function LandingBlogs() {
  return (
    <section aria-label="Blog placeholders" className="w-full px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
      <div className="mx-auto w-full max-w-[1160px]">
        <h2 className="mb-5 text-xl font-semibold tracking-tight text-black sm:text-2xl">
          Check our contents
        </h2>
        <div className="flex flex-col gap-5">
          {blogPlaceholders.map((blog, index) => (
            <article
              key={blog}
              data-scroll-reveal
              className="scroll-reveal grid grid-cols-[128px_minmax(0,1fr)] overflow-hidden bg-white transition-colors hover:bg-[#F7F8F7] sm:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]"
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <div className="relative aspect-video w-full self-start overflow-hidden bg-gray-100">
                <img
                  src={placeholderImages[index]}
                  alt="Blog placeholder image"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-center p-4 sm:p-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-600">
                  Date to be added
                </p>
                <h2 className="text-xl font-semibold leading-snug text-black sm:text-2xl">Blog title</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base">
                  Add a short blog summary here.
                </p>
                <p className="mt-4 text-sm font-medium text-gray-700">Author to be added</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <a
            href="/blogs"
            data-scroll-reveal
            className="scroll-reveal group inline-flex items-center gap-2 text-sm font-semibold text-gray-800 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:text-black active:-translate-y-0.5 active:text-black focus-visible:-translate-y-0.5 focus-visible:text-black sm:text-base"
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
