import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ContributorAvatar from '../../components/contributors/ContributorAvatar'
import ContributorSocialLinks from '../../components/contributors/ContributorSocialLinks'
import Icon from '../../components/Icon'
import BlogCard from '../../components/blogs/BlogCard'
import PaginationControls from '../../components/PaginationControls'
import { useContributor, useContributorBlogs } from '../../hooks/useContributors'
import { useToastError } from '../../hooks/useToast'

const BLOGS_PER_PAGE = 5

export default function ContributorDetails() {
  const { slug } = useParams()
  const { item: contributor, loading, error, reload } = useContributor(slug)
  const [pageState, setPageState] = useState({ slug, page: 1 })
  const page = pageState.slug === slug ? pageState.page : 1
  const {
    blogs,
    total,
    loading: blogsLoading,
    error: blogsError,
    reload: reloadBlogs,
  } = useContributorBlogs(slug, {
    limit: BLOGS_PER_PAGE,
    offset: (page - 1) * BLOGS_PER_PAGE,
  })
  useToastError(blogsError)

  if (loading) {
    return <p role="status" className="py-24 text-center text-sm text-muted">Loading contributor...</p>
  }

  if (error || !contributor) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Icon name="person_search" className="text-[40px] text-muted" />
        <p className="text-lg font-semibold text-on-surface">
          {error?.status === 404 || !error ? 'Contributor not found' : 'Contributor unavailable'}
        </p>
        <p className="max-w-md text-sm text-on-surface-variant">
          {error?.status === 404 || !error
            ? 'This profile may have been removed or the address may be incorrect.'
            : error.message}
        </p>
        {error && error.status !== 404 && (
          <button type="button" onClick={reload} className="text-sm font-semibold text-primary underline underline-offset-4">
            Try again
          </button>
        )}
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
        <ContributorAvatar
          contributor={contributor}
          className="aspect-square w-full max-w-xl rounded-xl"
        />

        <div className="flex flex-col gap-4 py-1 sm:py-3">
          <header>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-on-surface sm:text-3xl">
              {contributor.display_name}
            </h1>
            {contributor.alias && <p className="mt-1 text-base text-on-surface-variant">{contributor.alias}</p>}
          </header>

          {contributor.positions.length > 0 && (
            <p className="text-base font-semibold text-on-surface-variant">
              {contributor.positions.join(' · ')}
            </p>
          )}

          {contributor.bio && (
            <p className="max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant sm:text-base">
              {contributor.bio}
            </p>
          )}

          {contributor.contributions.length > 0 && (
            <section aria-labelledby="contributions-heading" className="flex flex-col gap-2">
              <h2 id="contributions-heading" className="text-sm font-semibold text-on-surface">
                Contributions
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-on-surface-variant sm:text-base">
                {contributor.contributions.map((contribution, index) => (
                  <li key={`${index}-${contribution}`}>{contribution}</li>
                ))}
              </ul>
            </section>
          )}

          <ContributorSocialLinks
            name={contributor.display_name}
            links={contributor.social_links}
            className="gap-4"
          />
        </div>
      </div>

      {(blogsLoading || total > 0 || blogsError) && (
        <section className="border-t border-outline pt-6" aria-labelledby="contributor-blogs-heading">
          <div className="mb-4">
            <h2 id="contributor-blogs-heading" className="text-xl font-bold text-on-surface">
              Blogs by {contributor.display_name}
            </h2>
          </div>

          {blogsError && <div className="mb-4 text-right"><button type="button" onClick={reloadBlogs} className="text-sm font-semibold underline underline-offset-2">Retry loading blogs</button></div>}

          {blogsLoading && blogs.length === 0 ? (
            <p role="status" className="py-6 text-sm text-muted">Loading blogs...</p>
          ) : blogs.length > 0 ? (
            <div className="flex flex-col">
              {blogs.map((blog) => (
                <BlogCard key={blog.id} blog={blog} to={`/blog/${blog.slug}`} wholeCardLink />
              ))}
            </div>
          ) : !blogsError ? (
            <p className="py-6 text-sm text-muted">No published blogs yet.</p>
          ) : null}

          <PaginationControls
            currentPage={page}
            total={total}
            pageSize={BLOGS_PER_PAGE}
            onPageChange={(nextPage) => setPageState({ slug, page: nextPage })}
          />
        </section>
      )}
    </article>
  )
}
