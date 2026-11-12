import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function dateValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

type CalendarDatePickerProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  min?: string
  max?: string
  align?: 'left' | 'right'
  label?: string
}

/** Shared date picker using the same calendar UI as the Events form. */
export default function CalendarDatePicker({
  value,
  onChange,
  className = 'flex h-10 w-full items-center justify-between rounded-lg border border-outline bg-surface-lowest px-3 text-sm text-on-surface transition-colors hover:bg-surface-low',
  min,
  max,
  align = 'left',
  label = 'Choose date',
}: CalendarDatePickerProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = parseDate(value)
  const [view, setView] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function toggle() {
    if (!open) setView(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    setOpen((current) => !current)
  }

  const firstWeekday = new Date(view.getFullYear(), view.getMonth(), 1).getDay()
  const cells = Array.from({ length: 42 }, (_, index) => new Date(view.getFullYear(), view.getMonth(), index + 1 - firstWeekday))
  const today = dateValue(new Date())
  const formattedValue = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div ref={pickerRef} className="relative">
      <button
        type="button"
        aria-label={`${label}: ${formattedValue}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className={className}
      >
        <span>{formattedValue}</span>
        <Icon name="calendar_month" className="ml-2 shrink-0 text-[18px] text-muted" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-30 mt-2 w-72 rounded-xl border border-outline bg-surface-lowest p-4 shadow-float ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-on-surface">
              {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setView((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
              >
                <Icon name="chevron_left" className="text-[18px]" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setView((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
              >
                <Icon name="chevron_right" className="text-[18px]" />
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAYS.map((day, index) => (
              <span key={index} className="text-xs font-semibold text-muted">{day}</span>
            ))}
            {cells.map((cell) => {
              const cellValue = dateValue(cell)
              const selected = cellValue === value
              const inMonth = cell.getMonth() === view.getMonth()
              const disabled = (min !== undefined && cellValue < min) || (max !== undefined && cellValue > max)
              return (
                <button
                  key={cellValue}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(cellValue)
                    setOpen(false)
                  }}
                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                    disabled
                      ? 'cursor-not-allowed text-muted/30'
                      : selected
                        ? 'bg-on-surface font-bold text-surface-lowest'
                        : inMonth
                          ? `${cellValue === today ? 'font-bold text-on-surface' : 'text-on-surface-variant'} hover:bg-surface-low`
                          : 'text-muted/50 hover:bg-surface-low'
                  }`}
                >
                  {cell.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
