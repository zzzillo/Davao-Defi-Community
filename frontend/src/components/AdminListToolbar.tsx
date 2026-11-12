import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

type AdminListToolbarProps<T extends string> = {
  actionLabel?: string
  onAction?: () => void
  searchLabel: string
  searchPlaceholder: string
  searchValue: string
  onSearchChange: (value: string) => void
  selectedFilter?: T
  filterLabel?: string
  filterOptions?: readonly T[]
  onFilterChange?: (value: T) => void
}

export default function AdminListToolbar<T extends string>({
  actionLabel,
  onAction,
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  selectedFilter,
  filterLabel,
  filterOptions = [],
  onFilterChange,
}: AdminListToolbarProps<T>) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const hasFilter = filterOptions.length > 0 && selectedFilter !== undefined

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFilterOpen(false)
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:gap-3">
      {!searchOpen && actionLabel && onAction && (
        <button
          type="button"
          aria-label={actionLabel}
          onClick={onAction}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-low active:scale-[0.98] sm:hidden"
        >
          <Icon name="add" className="text-[22px]" />
        </button>
      )}

      {!searchOpen ? (
        <button
          type="button"
          aria-label={searchLabel}
          aria-expanded="false"
          onClick={() => {
            setFilterOpen(false)
            setSearchOpen(true)
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-low active:scale-[0.98] sm:hidden"
        >
          <Icon name="search" className="text-[22px]" />
        </button>
      ) : (
        <div className="relative min-w-0 flex-1 sm:hidden">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted"
          />
          <span className="sr-only">{searchLabel}</span>
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoFocus
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-lg border border-outline bg-surface-lowest pl-10 pr-10 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-low"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
      )}

      <label className={`relative hidden min-w-64 flex-1 sm:block ${hasFilter ? '' : 'sm:max-w-sm sm:flex-none'}`}>
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted"
        />
        <span className="sr-only">{searchLabel}</span>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-lg border border-outline bg-surface-lowest pl-10 pr-4 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </label>

      {hasFilter && (
        <div ref={filterRef} className={`relative ${searchOpen ? 'hidden sm:block' : ''}`}>
          <button
            type="button"
            aria-label={`${filterLabel ?? 'Filter'}: ${selectedFilter}`}
            aria-haspopup="menu"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center gap-1 rounded-lg text-sm font-medium text-on-surface transition-colors sm:w-40 sm:px-4"
          >
            <span className="hidden flex-1 text-center sm:block">{selectedFilter}</span>
            <Icon name={filterOpen ? 'expand_less' : 'expand_more'} className="text-[18px]" />
          </button>
          {filterOpen && (
            <div
              role="menu"
              aria-label={filterLabel ?? 'Filter'}
              className="absolute right-0 top-full z-50 mt-1 w-40 max-w-[calc(100vw-2rem)] rounded-lg border border-outline bg-surface-lowest p-1 shadow-float"
            >
              {filterOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selectedFilter === option}
                  onClick={() => {
                    onFilterChange?.(option)
                    setFilterOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-low ${selectedFilter === option ? 'text-on-surface' : 'text-on-surface-variant'}`}
                >
                  {option}
                  {selectedFilter === option && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
