import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import PaginationControls from '../../components/PaginationControls'
import { contributors, socialIcons } from '../../data/contributors'

const INITIAL_CONTRIBUTORS = 24
const MORE_CONTRIBUTORS = 12

export default function PublicContributors() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const search = query.trim().toLowerCase()
  const filteredContributors = contributors.filter((contributor) => (
    [contributor.name, contributor.alias, contributor.position, contributor.bio]
      .join(' ')
      .toLowerCase()
      .includes(search)
  ))
  const pageStart = page === 1 ? 0 : INITIAL_CONTRIBUTORS + (page - 2) * MORE_CONTRIBUTORS
  const pageSize = page === 1 ? INITIAL_CONTRIBUTORS : MORE_CONTRIBUTORS
  const visibleContributors = filteredContributors.slice(pageStart, pageStart + pageSize)

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
            setPage(1)
          }}
          placeholder="Search contributors"
          className="w-full rounded-lg border border-outline bg-surface-lowest py-2 pl-10 pr-3 text-sm text-on-surface placeholder:text-muted focus:outline-none"
        />
      </label>

      {filteredContributors.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No contributors match “{query.trim()}”.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleContributors.map((contributor) => (
            <article key={contributor.name} className="public-image-hover flex h-full flex-col overflow-hidden rounded-xl border border-outline bg-surface-lowest transition-shadow hover:shadow-float">
              <Link
                to={`/contributors/${contributor.slug}`}
                aria-label={`View ${contributor.name}'s profile`}
                className="public-image-frame group relative block aspect-square w-full flex-none overflow-hidden bg-surface-low focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
              >
                <img src={contributor.photo} alt={`Sample portrait of ${contributor.name}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent transition-opacity group-hover:from-black/90" />
                <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-16">
                  <h2 className="text-xl font-semibold leading-tight text-white">{contributor.name}</h2>
                  <p className="mt-1 text-sm text-white/75">{contributor.alias}</p>
                  <p className="mt-2 text-sm font-medium text-white/90">{contributor.position}</p>
                </div>
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <p className="flex-1 text-sm leading-relaxed text-on-surface-variant">{contributor.bio}</p>
                <nav aria-label={`${contributor.name} social links`} className="mt-5 flex items-center gap-3">
                  {contributor.socials.map((social) => (
                    <a key={social.network} href={social.url} target="_blank" rel="noreferrer" aria-label={`${contributor.name} on ${social.network}`} title={social.network} className="text-muted transition-colors hover:text-on-surface">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                        <path d={socialIcons[social.network]} />
                      </svg>
                    </a>
                  ))}
                </nav>
              </div>
            </article>
          ))}
        </div>
      )}

      <PaginationControls
        currentPage={page}
        total={filteredContributors.length}
        initialPageSize={INITIAL_CONTRIBUTORS}
        pageSize={MORE_CONTRIBUTORS}
        showCount={false}
        onPageChange={setPage}
      />
    </div>
  )
}
