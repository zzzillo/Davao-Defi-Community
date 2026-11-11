import { Link } from 'react-router-dom'
import ContributorAvatar from '../../components/contributors/ContributorAvatar'
import ContributorSocialLinks from '../../components/contributors/ContributorSocialLinks'
import Icon from '../../components/Icon'
import PaginationControls from '../../components/PaginationControls'
import { useContributors } from '../../hooks/useContributors'
import { useDebouncedSearchPagination } from '../../hooks/useDebouncedSearchPagination'
import { useToastError } from '../../hooks/useToast'

const INITIAL_CONTRIBUTORS = 24
const MORE_CONTRIBUTORS = 12

export default function PublicContributors() {
  const { query, setQuery, search, page, setPage } = useDebouncedSearchPagination()
  const pageSize = page === 1 ? INITIAL_CONTRIBUTORS : MORE_CONTRIBUTORS
  const offset = page === 1
    ? 0
    : INITIAL_CONTRIBUTORS + (page - 2) * MORE_CONTRIBUTORS
  const { contributors, total, loading, error, reload } = useContributors({
    search: search || undefined,
    limit: pageSize,
    offset,
  })
  useToastError(error)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Contributors</h1>
        <p className="text-on-surface-variant">
          Meet the volunteers building Davao DeFi together.
        </p>
      </div>

      <label className="relative flex w-full items-center sm:w-72 sm:shrink-0 sm:self-end">
        <Icon name="search" className="pointer-events-none absolute left-3 text-[20px] text-muted" />
        <span className="sr-only">Search contributors</span>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          placeholder="Search contributors"
          className="w-full rounded-lg border border-outline bg-surface-lowest py-2 pl-10 pr-3 text-sm text-on-surface placeholder:text-muted focus:outline-none"
        />
      </label>

      {error && <div className="flex justify-end"><button type="button" onClick={reload} className="text-sm font-semibold underline underline-offset-2">Retry loading contributors</button></div>}

      {loading && contributors.length === 0 ? (
        <p role="status" className="py-16 text-center text-sm text-muted">Loading contributors...</p>
      ) : error ? null : contributors.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {search
              ? `No contributors match “${search}”.`
              : 'No contributors are listed yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {contributors.map((contributor) => (
            <article key={contributor.public_slug} className="public-image-hover relative isolate flex h-full flex-col overflow-hidden rounded-xl border border-outline bg-surface-lowest transition-shadow hover:shadow-float">
              <Link
                to={`/contributors/${encodeURIComponent(contributor.public_slug)}`}
                aria-label={`View ${contributor.display_name}'s profile`}
                className="absolute inset-0 z-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
              />
              <div className="pointer-events-none relative z-0 flex flex-1 flex-col">
                <div className="public-image-frame group relative block aspect-square w-full flex-none overflow-hidden bg-surface-low">
                  <ContributorAvatar
                    contributor={contributor}
                    className="absolute inset-0"
                    imageClassName="transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent transition-opacity group-hover:from-black/90" />
                  <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-16">
                    <h2 className="text-xl font-semibold leading-tight text-white">{contributor.display_name}</h2>
                    {contributor.alias && <p className="mt-1 text-sm text-white/75">{contributor.alias}</p>}
                    {contributor.positions.length > 0 && (
                      <p className="mt-2 text-sm font-medium text-white/90">
                        {contributor.positions.join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  {contributor.bio && (
                    <p className="flex-1 text-sm leading-relaxed text-on-surface-variant">{contributor.bio}</p>
                  )}
                </div>
              </div>
              <ContributorSocialLinks
                name={contributor.display_name}
                links={contributor.social_links}
                className="pointer-events-none relative z-10 mt-auto px-5 pb-5 [&>a]:pointer-events-auto"
              />
            </article>
          ))}
        </div>
      )}

      <PaginationControls
        currentPage={page}
        total={total}
        initialPageSize={INITIAL_CONTRIBUTORS}
        pageSize={MORE_CONTRIBUTORS}
        showCount={false}
        onPageChange={setPage}
      />
    </div>
  )
}
