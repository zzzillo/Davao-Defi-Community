import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import BlogCard from '../../components/blogs/BlogCard'
import PaginationControls from '../../components/PaginationControls'
import { contributors, socialIcons } from '../../data/contributors'
import { useBlogs } from '../../hooks/useBlogs'
import { useState } from 'react'

const BLOGS_PER_PAGE = 5

export default function ContributorDetails() {
  const { slug } = useParams()
  const contributor = contributors.find((person) => person.slug === slug)
  const [page, setPage] = useState(1)
  const { blogs, total, loading: blogsLoading } = useBlogs({
    creator_id: contributor?.blogCreatorId ?? 'no-contributor',
    limit: BLOGS_PER_PAGE,
    offset: (page - 1) * BLOGS_PER_PAGE,
  })

  if (!contributor) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Icon name="person_search" className="text-[40px] text-muted" />
        <p className="text-lg font-semibold text-on-surface">Contributor not found</p>
        <p className="max-w-md text-sm text-on-surface-variant">
          This profile may have been removed or the address may be incorrect.
        </p>
        <Link
          to="/contributors"
          className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          Browse contributors
        </Link>
      </div>
    )
  }

  return (
    <article className="flex flex-col gap-6">
      <Link
        to="/contributors"
        className="flex w-fit items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Icon name="arrow_back" className="text-[20px]" />
        Back to contributors
      </Link>

      <div className="grid items-start gap-6 sm:gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="aspect-square w-full max-w-xl overflow-hidden rounded-xl bg-surface-low">
          <img
            src={contributor.photo}
            alt={`Sample portrait of ${contributor.name}`}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col gap-4 py-1 sm:py-3">
          <header>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-on-surface sm:text-3xl">
              {contributor.name}
            </h1>
            <p className="mt-1 text-base text-on-surface-variant">{contributor.alias}</p>
          </header>

          <p className="text-base font-semibold text-on-surface-variant">
            {contributor.position}
          </p>

          <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
            {contributor.bio}
          </p>

          {contributor.contributions.length > 0 && (
            <section aria-labelledby="contributions-heading" className="flex flex-col gap-2">
              <h2 id="contributions-heading" className="text-sm font-semibold text-on-surface">
                Contributions
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-on-surface-variant sm:text-base">
                {contributor.contributions.map((contribution) => (
                  <li key={contribution}>{contribution}</li>
                ))}
              </ul>
            </section>
          )}

          <nav aria-label={`${contributor.name} social links`} className="flex items-center gap-4">
            {contributor.socials.map((social) => (
              <a
                key={social.network}
                href={social.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${contributor.name} on ${social.network}`}
                title={social.network}
                className="text-muted transition-colors hover:text-on-surface"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d={socialIcons[social.network]} />
                </svg>
              </a>
            ))}
          </nav>
        </div>
      </div>

      {(blogsLoading || total > 0) && (
        <section className="border-t border-outline pt-6" aria-labelledby="contributor-blogs-heading">
          <div className="mb-4">
            <h2 id="contributor-blogs-heading" className="text-xl font-bold text-on-surface">
              Blogs by {contributor.name}
            </h2>
          </div>

          {blogsLoading && blogs.length === 0 ? (
            <p className="py-6 text-sm text-muted">Loading blogs...</p>
          ) : (
            <div className="flex flex-col">
              {blogs.map((blog) => (
                <BlogCard key={blog.id} blog={blog} to={`/blog/${blog.slug}`} wholeCardLink />
              ))}
            </div>
          )}
          <PaginationControls
            currentPage={page}
            total={total}
            pageSize={BLOGS_PER_PAGE}
            onPageChange={setPage}
          />
        </section>
      )}
    </article>
  )
}
