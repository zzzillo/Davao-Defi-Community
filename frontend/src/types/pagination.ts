/**
 * The shape every list endpoint returns.
 *
 * Mirrors app/schemas/pagination.py. One shape across Events, Posts and the
 * admin user table means one pager component can render any of them.
 *
 * Hand-written, so it can drift from the backend. Check
 * http://127.0.0.1:8000/docs after any schema change there.
 */
export type Page<T> = {
  items: T[]
  /** Rows matching the filters before paging - what "of 57" needs. */
  total: number
  limit: number
  offset: number
  /** 1-based, for rendering "Page 3 of 5". Derived server-side from offset. */
  page: number
  /** Whether asking for the next slice would return anything. */
  has_next: boolean
}

/** The paging half of any list request. Modules add their own filters. */
export type PageParams = {
  limit?: number
  offset?: number
}
