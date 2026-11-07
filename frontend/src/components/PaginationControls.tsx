import Icon from './Icon'

type PaginationControlsProps = {
  currentPage: number
  total: number
  pageSize: number
  initialPageSize?: number
  showCount?: boolean
  onPageChange: (page: number) => void
}

function visiblePages(currentPage: number, pageCount: number) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1])
  if (currentPage <= 3) [2, 3, 4].forEach((page) => pages.add(page))
  if (currentPage >= pageCount - 2) {
    [pageCount - 3, pageCount - 2, pageCount - 1].forEach((page) => pages.add(page))
  }

  return [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b)
}

export default function PaginationControls({
  currentPage,
  total,
  pageSize,
  initialPageSize = pageSize,
  showCount = true,
  onPageChange,
}: PaginationControlsProps) {
  const pageCount = total <= initialPageSize
    ? 1
    : 1 + Math.ceil((total - initialPageSize) / pageSize)
  if (pageCount <= 1) return null

  const firstItem = currentPage === 1 ? 1 : initialPageSize + (currentPage - 2) * pageSize + 1
  const lastItem = Math.min(currentPage === 1 ? initialPageSize : initialPageSize + (currentPage - 1) * pageSize, total)
  const pages = visiblePages(currentPage, pageCount)
  let previousPage = 0

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      {showCount && <p className="text-sm text-muted">Showing {firstItem}-{lastItem} of {total}</p>}

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="chevron_left" className="text-[20px]" />
        </button>

        {pages.map((page) => {
          const isGap = previousPage > 0 && page - previousPage > 1
          previousPage = page

          return (
            <span key={page} className="flex items-center gap-1">
              {isGap && <span className="px-1 text-sm text-muted">…</span>}
              <button
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? 'page' : undefined}
                aria-label={`Page ${page}`}
                className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-surface-low text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-low'
                }`}
              >
                {page}
              </button>
            </span>
          )
        })}

        <button
          type="button"
          disabled={currentPage === pageCount}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="chevron_right" className="text-[20px]" />
        </button>
      </div>
    </nav>
  )
}
