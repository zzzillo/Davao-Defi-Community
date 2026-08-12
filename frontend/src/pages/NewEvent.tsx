import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'

type Theme = {
  name: string
  pattern: React.CSSProperties
}

const themes: Theme[] = [
  {
    name: 'Minimal',
    pattern: { backgroundColor: '#ededed' },
  },
  {
    name: 'Quantum',
    pattern: {
      backgroundColor: '#e6e6e6',
      backgroundImage: 'radial-gradient(circle, #a8a8a8 1.5px, transparent 1.5px)',
      backgroundSize: '18px 18px',
    },
  },
  {
    name: 'Warp',
    pattern: {
      backgroundColor: '#e9e9e9',
      backgroundImage:
        'repeating-linear-gradient(45deg, #c4c4c4 0px, #c4c4c4 2px, transparent 2px, transparent 14px)',
    },
  },
  {
    name: 'Emoji',
    pattern: {
      backgroundColor: '#ececec',
      backgroundImage:
        'linear-gradient(45deg, #d4d4d4 25%, transparent 25%, transparent 75%, #d4d4d4 75%), linear-gradient(45deg, #d4d4d4 25%, transparent 25%, transparent 75%, #d4d4d4 75%)',
      backgroundSize: '24px 24px',
      backgroundPosition: '0 0, 12px 12px',
    },
  },
  {
    name: 'Confetti',
    pattern: {
      backgroundColor: '#e8e8e8',
      backgroundImage:
        'radial-gradient(circle, #9e9e9e 1px, transparent 1px), radial-gradient(circle, #c0c0c0 1.5px, transparent 1.5px), radial-gradient(circle, #b0b0b0 1px, transparent 1px)',
      backgroundSize: '28px 28px, 36px 36px, 22px 22px',
      backgroundPosition: '0 0, 14px 10px, 8px 20px',
    },
  },
  {
    name: 'Pattern',
    pattern: {
      backgroundColor: '#eaeaea',
      backgroundImage:
        'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 10px, #c8c8c8 10px, #c8c8c8 12px)',
      backgroundSize: '48px 48px',
    },
  },
  {
    name: 'Seasonal',
    pattern: {
      backgroundColor: '#e7e7e7',
      backgroundImage:
        'repeating-linear-gradient(90deg, #cccccc 0px, #cccccc 6px, transparent 6px, transparent 20px)',
    },
  },
]

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function formatDay(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(minutes: number) {
  const hours24 = Math.floor(minutes / 60)
  const mins = minutes % 60
  const ampm = hours24 >= 12 ? 'PM' : 'AM'
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`
}

function durationLabel(diff: number) {
  const hours = Math.floor(diff / 60)
  const mins = diff % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const recentLocations = [
  {
    name: 'Connecteacupz',
    address: '84 Teodoro Palma Gil St, Obrero, Davao City, Davao del Sur, Philippines',
  },
  {
    name: 'SMX Convention Center Davao',
    address: 'SM Lanang Premier, J.P. Laurel Ave, Davao City, Philippines',
  },
  {
    name: 'Matina Town Square',
    address: 'MacArthur Hwy, Matina, Davao City, Philippines',
  },
]

const optionRowClass = 'flex items-center gap-2.5 rounded-lg bg-surface-low px-3 py-2'
const optionSelectClass =
  'ml-auto max-w-[45%] cursor-pointer bg-transparent text-right text-sm font-medium text-on-surface-variant focus:outline-none'

export default function NewEvent() {
  const navigate = useNavigate()
  const [themeIndex, setThemeIndex] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [color, setColor] = useState('Default')
  const [style, setStyle] = useState('—')
  const [font, setFont] = useState('Default')
  const [display, setDisplay] = useState('Auto')
  const [startDate, setStartDate] = useState(() => new Date())
  const [endDate, setEndDate] = useState(() => new Date())
  const [startTime, setStartTime] = useState(17 * 60 + 30)
  const [endTime, setEndTime] = useState(18 * 60 + 30)
  const [picker, setPicker] = useState<'startDate' | 'endDate' | 'startTime' | 'endTime' | null>(
    null,
  )
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())

  function openPicker(kind: 'startDate' | 'endDate' | 'startTime' | 'endTime') {
    if (picker === kind) {
      setPicker(null)
      return
    }
    if (kind === 'startDate' || kind === 'endDate') {
      const date = kind === 'startDate' ? startDate : endDate
      setViewYear(date.getFullYear())
      setViewMonth(date.getMonth())
    }
    setPicker(kind)
  }

  function calendarCells() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(viewYear, viewMonth, i + 1 - firstDay))
    }
    return cells
  }

  function pickDate(date: Date) {
    if (picker === 'startDate') setStartDate(date)
    if (picker === 'endDate') setEndDate(date)
    setPicker(null)
  }

  const pickerField =
    'rounded-md bg-surface-low px-2.5 py-1 text-sm text-on-surface transition-colors hover:bg-surface-container'

  const dateCardRef = useRef<HTMLDivElement>(null)
  const locationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      const target = event.target as Node
      if (!target.isConnected) return
      if (!dateCardRef.current?.contains(target)) setPicker(null)
      if (!locationRef.current?.contains(target)) setLocationOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  const [locationOpen, setLocationOpen] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [location, setLocation] = useState<
    { kind: 'place'; name: string; address: string } | { kind: 'virtual' } | null
  >(null)

  const matchedLocations = recentLocations.filter((place) =>
    `${place.name} ${place.address}`.toLowerCase().includes(locationQuery.trim().toLowerCase()),
  )

  function chooseLocation(choice: { kind: 'place'; name: string; address: string } | { kind: 'virtual' }) {
    setLocation(choice)
    setLocationOpen(false)
    setLocationQuery('')
  }

  const theme = themes[themeIndex]

  function shuffleTheme() {
    setThemeIndex((current) => {
      const next = Math.floor(Math.random() * (themes.length - 1))
      return next >= current ? next + 1 : next
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => navigate('/events')}
          className="flex items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" className="text-[20px]" />
          Back to Events
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-3">
          <div
            className="relative aspect-square w-full overflow-hidden rounded-xl border border-outline"
            style={theme.pattern}
          >
            <button
              type="button"
              aria-label="Upload event image"
              className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-lowest text-on-surface shadow-float transition-colors hover:bg-surface-low"
            >
              <Icon name="image" className="text-[20px]" />
            </button>
          </div>

          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen((open) => !open)}
              className="flex flex-1 items-center gap-3 rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-left transition-colors hover:bg-surface-low"
            >
              <span
                className="h-9 w-12 shrink-0 rounded border border-outline"
                style={theme.pattern}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-[11px] font-medium text-muted">Theme</span>
                <span className="truncate text-sm font-semibold text-on-surface">{theme.name}</span>
              </span>
              <Icon name="unfold_more" className="ml-auto text-[18px] text-muted" />
            </button>
            <button
              type="button"
              aria-label="Shuffle theme"
              onClick={shuffleTheme}
              className="flex w-[52px] items-center justify-center rounded-lg border border-outline bg-surface-lowest text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
            >
              <Icon name="shuffle" className="text-[20px]" />
            </button>
          </div>

          {drawerOpen && (
            <div className="flex flex-col gap-4 rounded-xl border border-outline bg-surface-lowest p-4 shadow-float">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {themes.map((option, index) => (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => setThemeIndex(index)}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                  >
                    <span
                      className={`h-12 w-16 rounded-lg border border-outline ${
                        index === themeIndex ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-lowest' : ''
                      }`}
                      style={option.pattern}
                    />
                    <span
                      className={`text-xs ${
                        index === themeIndex
                          ? 'font-bold text-on-surface'
                          : 'font-medium text-on-surface-variant'
                      }`}
                    >
                      {option.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className={optionRowClass}>
                  <span className="h-4 w-4 shrink-0 rounded-full border border-outline-strong bg-surface-highest" />
                  <span className="text-sm font-medium text-on-surface">Color</span>
                  <select
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className={optionSelectClass}
                  >
                    <option>Default</option>
                    <option>Gray</option>
                    <option>Contrast</option>
                  </select>
                </label>
                <label className={optionRowClass}>
                  <Icon name="texture" className="shrink-0 text-[18px] text-on-surface-variant" />
                  <span className="text-sm font-medium text-on-surface">Style</span>
                  <select
                    value={style}
                    onChange={(event) => setStyle(event.target.value)}
                    className={optionSelectClass}
                  >
                    <option>{'—'}</option>
                    <option>Soft</option>
                    <option>Sharp</option>
                  </select>
                </label>
                <label className={optionRowClass}>
                  <span className="shrink-0 text-sm font-semibold text-on-surface-variant">Ag</span>
                  <span className="text-sm font-medium text-on-surface">Font</span>
                  <select
                    value={font}
                    onChange={(event) => setFont(event.target.value)}
                    className={optionSelectClass}
                  >
                    <option>Default</option>
                    <option>Serif</option>
                    <option>Mono</option>
                  </select>
                </label>
                <label className={optionRowClass}>
                  <Icon name="contrast" className="shrink-0 text-[18px] text-on-surface-variant" />
                  <span className="text-sm font-medium text-on-surface">Display</span>
                  <select
                    value={display}
                    onChange={(event) => setDisplay(event.target.value)}
                    className={optionSelectClass}
                  >
                    <option>Auto</option>
                    <option>Light</option>
                    <option>Dark</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Event Name"
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault()
            }}
            className="title-block w-full whitespace-pre-wrap break-words bg-transparent text-4xl font-bold leading-tight tracking-tight text-on-surface focus:outline-none"
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <div
              ref={dateCardRef}
              className="relative flex-1 rounded-xl border border-outline bg-surface-lowest px-4 py-2"
            >
              <span className="absolute bottom-6 left-[19.5px] top-6 w-px bg-outline-strong" />
              <div className="flex items-center gap-3 py-1.5">
                <span className="relative z-10 h-2 w-2 shrink-0 rounded-full bg-on-surface-variant" />
                <span className="text-sm font-medium text-on-surface">Start</span>
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => openPicker('startDate')} className={pickerField}>
                    {formatDay(startDate)}
                  </button>
                  <button type="button" onClick={() => openPicker('startTime')} className={pickerField}>
                    {formatTime(startTime)}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 py-1.5">
                <span className="relative z-10 h-2 w-2 shrink-0 rounded-full border border-outline-strong bg-surface-lowest" />
                <span className="text-sm font-medium text-on-surface">End</span>
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => openPicker('endDate')} className={pickerField}>
                    {formatDay(endDate)}
                  </button>
                  <button type="button" onClick={() => openPicker('endTime')} className={pickerField}>
                    {formatTime(endTime)}
                  </button>
                </div>
              </div>
              {(picker === 'startDate' || picker === 'endDate') && (
                <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-outline bg-surface-lowest p-4 shadow-float">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-on-surface">
                      {new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
                        month: 'long',
                        year: undefined,
                      })}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Previous month"
                        onClick={() => {
                          const previous = new Date(viewYear, viewMonth - 1)
                          setViewYear(previous.getFullYear())
                          setViewMonth(previous.getMonth())
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
                      >
                        <Icon name="chevron_left" className="text-[18px]" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next month"
                        onClick={() => {
                          const next = new Date(viewYear, viewMonth + 1)
                          setViewYear(next.getFullYear())
                          setViewMonth(next.getMonth())
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
                      >
                        <Icon name="chevron_right" className="text-[18px]" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
                    {WEEKDAYS.map((day, index) => (
                      <span key={index} className="text-xs font-semibold text-muted">
                        {day}
                      </span>
                    ))}
                    {calendarCells().map((cell) => {
                      const selected = sameDay(
                        cell,
                        picker === 'startDate' ? startDate : endDate,
                      )
                      const inMonth = cell.getMonth() === viewMonth
                      const today = sameDay(cell, new Date())
                      return (
                        <button
                          key={cell.toISOString()}
                          type="button"
                          onClick={() => pickDate(cell)}
                          className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                            selected
                              ? 'bg-on-surface font-bold text-surface-lowest'
                              : inMonth
                                ? `${today ? 'font-bold text-on-surface' : 'text-on-surface-variant'} hover:bg-surface-low`
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
              {(picker === 'startTime' || picker === 'endTime') && (
                <div className="absolute right-0 top-full z-20 mt-2 max-h-72 w-48 overflow-y-auto rounded-xl border border-outline bg-surface-lowest p-1 shadow-float">
                  {(picker === 'startTime'
                    ? Array.from({ length: 48 }, (_, i) => i * 30)
                    : Array.from({ length: 24 }, (_, i) => startTime + 30 + i * 30).filter(
                        (t) => t < 24 * 60,
                      )
                  ).map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => {
                        if (picker === 'startTime') setStartTime(minutes)
                        else setEndTime(minutes)
                        setPicker(null)
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-surface-low"
                    >
                      <span className="font-medium text-on-surface">{formatTime(minutes)}</span>
                      {picker === 'endTime' && (
                        <span className="text-muted">{durationLabel(minutes - startTime)}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col justify-center gap-1 rounded-xl border border-outline bg-surface-lowest px-4 py-3 sm:w-36">
              <Icon name="globe" className="text-[18px] text-on-surface-variant" />
              <span className="text-sm font-medium text-on-surface">GMT+08:00</span>
              <span className="text-xs text-muted">Manila</span>
            </div>
          </div>

          <div ref={locationRef} className="relative">
            <button
              type="button"
              onClick={() => setLocationOpen((open) => !open)}
              className="flex w-full items-start gap-3 rounded-xl border border-outline bg-surface-lowest px-4 py-3 text-left transition-colors hover:bg-surface-low"
            >
              <Icon
                name={location?.kind === 'virtual' ? 'videocam' : 'location_on'}
                className="mt-0.5 text-[20px] text-on-surface-variant"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-on-surface">
                  {location === null
                    ? 'Add Event Location'
                    : location.kind === 'virtual'
                      ? 'Virtual Event'
                      : location.name}
                </span>
                <span className="truncate text-sm text-muted">
                  {location === null
                    ? 'Offline location or virtual link'
                    : location.kind === 'virtual'
                      ? 'Attendees join through a link'
                      : location.address}
                </span>
              </span>
              {location?.kind === 'place' && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${location.name} ${location.address}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  aria-label="Open in Google Maps"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  <Icon name="map" className="text-[18px]" />
                </a>
              )}
            </button>
            {locationOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-outline bg-surface-lowest shadow-float">
                <input
                  autoFocus
                  type="text"
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder="Enter location or virtual link"
                  className="w-full border-b border-outline bg-transparent px-4 py-3 text-base text-on-surface placeholder:text-muted focus:outline-none"
                />
                <div className="max-h-72 overflow-y-auto p-2">
                  <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    Recent Locations
                  </p>
                  {matchedLocations.map((place) => (
                    <button
                      key={place.name}
                      type="button"
                      onClick={() => chooseLocation({ kind: 'place', ...place })}
                      className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-low"
                    >
                      <Icon name="location_on" className="mt-0.5 text-[18px] text-muted" />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold text-on-surface">{place.name}</span>
                        <span className="truncate text-sm text-muted">{place.address}</span>
                      </span>
                    </button>
                  ))}
                  {locationQuery.trim() !== '' && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        locationQuery.trim(),
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-low"
                    >
                      <Icon name="map" className="mt-0.5 text-[18px] text-muted" />
                      <span className="text-sm font-medium text-on-surface">
                        Search "{locationQuery.trim()}" on Google Maps
                      </span>
                    </a>
                  )}
                  <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    Virtual Options
                  </p>
                  <button
                    type="button"
                    onClick={() => chooseLocation({ kind: 'virtual' })}
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-low"
                  >
                    <Icon name="videocam" className="mt-0.5 text-[18px] text-muted" />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-on-surface">Virtual Event</span>
                      <span className="text-sm text-muted">Attendees join through a link</span>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <label className="flex cursor-text items-start gap-3 rounded-xl border border-outline bg-surface-lowest px-4 py-3 transition-colors focus-within:border-outline-strong">
            <Icon name="notes" className="mt-0.5 text-[20px] text-on-surface-variant" />
            <textarea
              rows={3}
              placeholder="Add Description"
              className="w-full resize-none bg-transparent text-sm text-on-surface placeholder:text-muted focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => navigate('/events')}
            className="w-full rounded-lg bg-transparent hover:bg-btn py-3 text-base font-semibold text-on-surface transition-colors"
          >
            Create Event
          </button>
        </div>
      </div>
    </div>
  )
}
