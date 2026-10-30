export default function EventRecapsCallout({ animated = false }: { animated?: boolean }) {
  const revealClass = animated ? 'scroll-reveal' : ''

  return (
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p
        data-scroll-reveal={animated ? '' : undefined}
        className={`${revealClass} max-w-xl text-sm leading-relaxed text-gray-600 dark:text-[#b5b5b5] sm:text-base`}
      >
        Past event highlights, photos, and recaps are shared on our Recaps page.
      </p>
      <a
        href="/recaps"
        data-scroll-reveal={animated ? '' : undefined}
        className={`${revealClass} group inline-flex w-fit items-center gap-2 text-sm font-semibold text-gray-800 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:text-black focus-visible:-translate-y-0.5 focus-visible:text-black dark:text-[#b5b5b5] dark:hover:text-white sm:text-base`}
      >
        Browse event recaps
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
  )
}
