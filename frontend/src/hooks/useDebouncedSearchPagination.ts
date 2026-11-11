import { useCallback, useEffect, useState } from 'react'
import { useDebouncedValue } from './useDebouncedValue'

/**
 * Search input state stays immediate while requests and pagination follow the
 * settled query. Page state is scoped to that query so a new search starts at
 * page one in the same render that changes the request key.
 */
export function useDebouncedSearchPagination(delayMs = 300) {
  const [query, setQuery] = useState('')
  const search = useDebouncedValue(query.trim(), delayMs)
  const [pagination, setPagination] = useState({ search, page: 1 })

  // Derive page one as soon as the settled query changes, avoiding a request
  // for the new query at the previous page while this state is synchronized.
  const page = pagination.search === search ? pagination.page : 1

  useEffect(() => {
    setPagination((current) =>
      current.search === search ? current : { search, page: 1 },
    )
  }, [search])

  const setPage = useCallback((nextPage: number | ((currentPage: number) => number)) => {
    setPagination((current) => {
      const currentPage = current.search === search ? current.page : 1
      return {
        search,
        page: typeof nextPage === 'function' ? nextPage(currentPage) : nextPage,
      }
    })
  }, [search])

  return { query, setQuery, search, page, setPage }
}
