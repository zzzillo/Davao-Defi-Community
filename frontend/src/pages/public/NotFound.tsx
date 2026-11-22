import { Link } from 'react-router-dom'

import Icon from '../../components/Icon'
import PageMeta from '../../components/PageMeta'

/**
 * Any address no route claims.
 *
 * Marked noindex so a mistyped or stale link never becomes a search result.
 * Crawlers also get a real 404 status from the edge middleware
 * (frontend/middleware.ts); people get this page.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <PageMeta title="Page not found" noindex />
      <Icon name="search" className="text-[40px] text-muted" />
      <h1 className="text-lg font-semibold text-on-surface">Page not found</h1>
      <p className="max-w-md text-sm text-on-surface-variant">
        This address does not match any page on the site. It may have moved, or the link may be mistyped.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
      >
        Go to the home page
      </Link>
    </div>
  )
}
