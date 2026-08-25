import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useEvent, useEvents } from '../../hooks/useEvents'
import { usePosts } from '../../hooks/usePosts'
import { formatEventDay } from '../../utils/event'

type EventSelectorProps = {
  /** The linked event id, or null for a standalone post. */
  value: string | null
  onChange: (eventId: string | null) => void
  disabled?: boolean
}

const RESULT_LIMIT = 20

/**
 * Choose the event a post recaps, or leave it standalone.
 *
 * A searchable picker rather than the plain text input in the mockup. An id
 * field would mean copying a UUID from another page, which nobody will do
 * correctly twice - and the field is optional, so the cost of getting it wrong
 * is a post silently attached to the wrong event.
 *
 * It also shows which events already have a recap, because the API allows only
 * one and finding that out by being refused on save is a poor way to learn it.
 * That check reads published recaps only: seeing drafts would require the
 * posts.read permission, and an official who may write posts but not read
 * drafts should still get a working picker. A draft recap therefore still
 * surfaces as a 409 on save, which the form handles.
 */
export default function EventSelector({
  value,
  onChange,
  disabled = false,
}: EventSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onOutsideClick(event: MouseEvent) {
      const target = event.target as Node

      if (!target.isConnected) return
      if (!containerRef.current?.contains(target)) setOpen(false)
    }

    document.addEventListener('mousedown', onOutsideClick)

    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [open])

  // Search runs on the server, so wait for a pause in typing.
  const search = useDebouncedValue(query.trim(), 300)

  // Published events only - see the note above about permissions.
  const { events, loading } = useEvents({ search: search || undefined, limit: RESULT_LIMIT })

  // One request that tells us every event already spoken for, rather than one
  // request per row.
  const { posts: recaps } = usePosts({ limit: 100 })
  const takenEventIds = new Set(recaps.map((post) => post.event?.id).filter(Boolean))

  // The current selection may not appear in the search results, so it is
  // fetched by id. Passing null keeps the hook idle for a standalone post.
  const { event: selected } = useEvent(value)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="flex w-full items-center gap-3 rounded-lg border border-outline bg-surface-lowest px-4 py-3 text-left transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="calendar_month" className="text-[20px] text-muted" />

        <span className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <span className="truncate text-sm font-medium text-on-surface">
                {selected.title}
              </span>
              <span className="text-xs text-muted">
                {formatEventDay(selected.start_datetime)}
              </span>
            </>
          ) : (
            <span className="text-sm text-on-surface-variant">
              Connect an event <span className="text-muted">(optional)</span>
            </span>
          )}
        </span>

        {value && (
          // A span rather than a nested button: a button inside a button is
          // invalid HTML. This still needs to be reachable, so the parent's
          // click is intercepted here.
          <span
            role="button"
            tabIndex={0}
            aria-label="Remove the linked event"
            onClick={(event) => {
              event.stopPropagation()
              onChange(null)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              event.stopPropagation()
              onChange(null)
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <Icon name="close" className="text-[18px]" />
          </span>
        )}

        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[20px] text-muted" />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-outline bg-surface-lowest shadow-float">
          <div className="border-b border-outline p-2">
            <label className="relative flex items-center">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 text-[18px] text-muted"
              />
              <span className="sr-only">Search events</span>
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search events"
                className="w-full rounded-lg bg-surface-low py-2 pl-9 pr-3 text-sm text-on-surface placeholder:text-muted focus:outline-none"
              />
            </label>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {loading ? (
              <p className="px-3 py-4 text-center text-sm text-muted">Searching...</p>
            ) : events.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted">
                {search ? `No events match "${search}".` : 'No events yet.'}
              </p>
            ) : (
              events.map((event) => {
                const taken = takenEventIds.has(event.id) && event.id !== value

                return (
                  <button
                    key={event.id}
                    type="button"
                    disabled={taken}
                    onClick={() => {
                      onChange(event.id)
                      setOpen(false)
                      setQuery('')
                    }}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <Icon name="calendar_month" className="mt-0.5 text-[18px] text-muted" />

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-on-surface">
                        {event.title}
                      </span>
                      <span className="text-xs text-muted">
                        {formatEventDay(event.start_datetime)}
                        {taken && ' · already has a recap'}
                      </span>
                    </span>

                    {event.id === value && (
                      <Icon name="check" className="text-[18px] text-on-surface" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
