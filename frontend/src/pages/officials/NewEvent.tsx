import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import RichTextEditor from '../../components/RichTextEditor'
import TimePicker from '../../components/TimePicker'
import { useEvent, useEventActions } from '../../hooks/useEvents'
import { useLocationSearch } from '../../hooks/useLocationSearch'
import type { EventCreatePayload } from '../../types/event'
import { stripHtml, toIsoWithOffset, wallClockInOffset } from '../../utils/event'


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

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const timezones = [
  { label: 'Philippine Time', city: 'Manila', offset: 'GMT+08:00' },
  { label: 'Central Time', city: 'Chicago', offset: 'GMT-05:00' },
  { label: 'Eastern Time', city: 'Toronto', offset: 'GMT-04:00' },
  { label: 'Eastern Time', city: 'New York', offset: 'GMT-04:00' },
  { label: 'Pacific Time', city: 'Los Angeles', offset: 'GMT-07:00' },
  { label: 'Brasilia Standard Time', city: 'Sao Paulo', offset: 'GMT-03:00' },
  { label: 'United Kingdom Time', city: 'London', offset: 'GMT+01:00' },
  { label: 'Central European Time', city: 'Madrid', offset: 'GMT+02:00' },
  { label: 'Central European Time', city: 'Paris', offset: 'GMT+02:00' },
  { label: 'Gulf Standard Time', city: 'Dubai', offset: 'GMT+04:00' },
  { label: 'India Standard Time', city: 'Kolkata', offset: 'GMT+05:30' },
  { label: 'Singapore Standard Time', city: 'Singapore', offset: 'GMT+08:00' },
  { label: 'China Standard Time', city: 'Shanghai', offset: 'GMT+08:00' },
  { label: 'Japan Standard Time', city: 'Tokyo', offset: 'GMT+09:00' },
  { label: 'Australian Eastern Time', city: 'Sydney', offset: 'GMT+10:00' },
]

/** 5:30pm, the hour most community events actually start. */
const DEFAULT_START_MINUTES = 17 * 60 + 30

export default function NewEvent() {
  const navigate = useNavigate()
  const { id } = useParams()

  // On /events/edit/:id this fetches. On /events/new the hook is handed
  // undefined and stays idle, so one component serves both routes.
  const { event: editingEvent, loading: loadingEvent, error: loadError } = useEvent(id)
  const { create, update, saving, error: saveError } = useEventActions()

  // Defaults for a new event. An event being edited arrives asynchronously and
  // therefore cannot be read in a useState initialiser - those run once, before
  // the request finishes. The hydrate effect below fills them in on arrival.
  const [startDate, setStartDate] = useState(() => new Date())
  const [endDate, setEndDate] = useState(() => new Date())
  const [startTime, setStartTime] = useState(DEFAULT_START_MINUTES)
  const [endTime, setEndTime] = useState((DEFAULT_START_MINUTES + 60) % (24 * 60))
  // The title is a contentEditable div, so its text lives in the DOM rather
  // than in state. This mirror exists only so the submit button can tell
  // whether there is a title yet.
  const [titleText, setTitleText] = useState('')
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
    if (picker === 'startDate') {
      setStartDate(date)
      if (date > endDate) setEndDate(date)
    }
    if (picker === 'endDate') setEndDate(date)
    setPicker(null)
  }

  const pickerField =
    'rounded-md bg-surface-low px-2.5 py-1 text-sm text-on-surface transition-colors hover:bg-surface-container'

  const [eventImage, setEventImage] = useState<string | null>(null)
  // The API stores a boolean; "draft" is this form's word for its opposite.
  const [isDraft, setIsDraft] = useState(false)
  const titleRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const dateCardRef = useRef<HTMLDivElement>(null)
  const locationRef = useRef<HTMLDivElement>(null)

  const [locationOpen, setLocationOpen] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [location, setLocation] = useState<
    { kind: 'place'; name: string; address: string } | { kind: 'virtual' } | null
  >(null)

  const [timezone, setTimezone] = useState(timezones[0])
  const [tzOpen, setTzOpen] = useState(false)
  const [tzQuery, setTzQuery] = useState('')
  const tzRef = useRef<HTMLDivElement>(null)

  const matchedTimezones = timezones.filter((zone) =>
    `${zone.label} ${zone.city} ${zone.offset}`
      .toLowerCase()
      .includes(tzQuery.trim().toLowerCase()),
  )

  // All that is left of the editor here: whether the modal is open, and the
  // HTML itself. Every ref and every piece of toolbar state moved into
  // RichTextEditor, which is the only thing that ever read them.
  const [descOpen, setDescOpen] = useState(false)
  const [descHtml, setDescHtml] = useState('')

  // Closes every popover when the click lands outside it. Registered down here
  // rather than beside the first ref it uses, because an effect can only close
  // over declarations that already exist above it.
  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      const target = event.target as Node
      if (!target.isConnected) return
      if (!dateCardRef.current?.contains(target)) setPicker(null)
      if (!locationRef.current?.contains(target)) setLocationOpen(false)
      if (!tzRef.current?.contains(target)) setTzOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  // The editor's own logic - caret handling, the floating toolbar, the plus
  // menu, list outdenting - moved to components/RichTextEditor.tsx when Blogs
  // needed an identical one. Roughly four hundred lines left this file and
  // nothing about the event form changed.

  function closeDescModal() {
    // Nothing to read back: RichTextEditor publishes on every edit, so
    // descHtml is already current by the time Done is pressed.
    setDescOpen(false)
  }

  const descText = descHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const descPreview = descText.length > 80 ? `${descText.slice(0, 80).trimEnd()}...` : descText

  // Fill the form once the event being edited arrives.
  //
  // Done during render rather than in an effect. React documents this as the
  // way to adjust state when the thing being edited changes: React re-runs the
  // component before painting, so nothing flashes, and there is no second
  // commit the way an effect would cause.
  //
  // hydratedId also guards against the hook refetching - overwriting half-typed
  // edits with server values would be worse than showing something stale.
  const [hydratedId, setHydratedId] = useState<string | null>(null)

  if (editingEvent && editingEvent.id !== hydratedId) {
    setHydratedId(editingEvent.id)

    // The stored value is an instant. The pickers hold a wall clock, so it has
    // to be read in the offset the dropdown is showing, or editing an event
    // from a laptop in another country would quietly move it.
    const start = wallClockInOffset(editingEvent.start_datetime, timezone.offset)
    const end = editingEvent.end_datetime
      ? wallClockInOffset(editingEvent.end_datetime, timezone.offset)
      : start

    setStartDate(start.day)
    setStartTime(start.minutesIntoDay)
    setEndDate(end.day)
    setEndTime(end.minutesIntoDay)
    setIsDraft(!editingEvent.published)
    setDescHtml(editingEvent.description ?? '')
    setTitleText(editingEvent.title)
    setLocation(
      editingEvent.location === null
        ? null
        : editingEvent.location === 'Virtual'
          ? { kind: 'virtual' }
          : { kind: 'place', name: editingEvent.location, address: '' },
    )
  }

  // The title is a contentEditable that keeps its content in the DOM and seeds
  // itself once per mount, so setting state above does not reach it. Writing to
  // the DOM is what effects are actually for, and no state is touched here.
  //
  // The description used to need the same treatment. It no longer does:
  // RichTextEditor takes descHtml as a prop and seeds itself from it, and
  // descHtml is set in the render-phase block above like every other field.
  const domSyncedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!editingEvent || domSyncedIdRef.current === editingEvent.id) return

    domSyncedIdRef.current = editingEvent.id

    if (titleRef.current) titleRef.current.textContent = editingEvent.title
  }, [editingEvent])

  /** Everything the form holds, in the shape POST and PATCH both accept. */
  function buildPayload(): EventCreatePayload {
    const html = descHtml

    return {
      title: (titleRef.current?.textContent ?? '').trim(),
      // Rich HTML is stored as-is rather than flattened, because discarding
      // what someone typed into a formatting editor is not a saving. An empty
      // editor still leaves markup behind, so emptiness is judged on the text.
      description: stripHtml(html) ? html : null,
      location:
        location === null
          ? null
          : location.kind === 'virtual'
            ? 'Virtual'
            : [location.name, location.address].filter(Boolean).join(', '),
      start_datetime: toIsoWithOffset(startDate, startTime, timezone.offset),
      end_datetime: toIsoWithOffset(endDate, endTime, timezone.offset),
      published: !isDraft,
    }
  }

  async function handleSubmit() {
    try {
      if (editingEvent) {
        await update(editingEvent.id, buildPayload())
      } else {
        await create(buildPayload())
      }

      navigate('/admin/events')
    } catch {
      // useEventActions already captured it and the banner shows it. Staying on
      // the page is the point: navigating away would discard what was typed.
    }
  }

  // Place suggestions for whatever is in the location box. The debounce, the
  // request and the out-of-order handling all live in the hook.
  const { canSearch, searching, places } = useLocationSearch(locationQuery)

  function chooseLocation(choice: { kind: 'place'; name: string; address: string } | { kind: 'virtual' }) {
    setLocation(choice)
    setLocationOpen(false)
    setLocationQuery('')
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/admin/events')}
          className="flex items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" className="text-[20px]" />
          Back to Events
        </button>
        <button
          type="button"
          onClick={() => setIsDraft((draft) => !draft)}
          className="flex items-center gap-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Save as Draft
          <span
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              isDraft ? 'bg-on-surface' : 'bg-surface-highest'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface-lowest shadow transition-all ${
                isDraft ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) setEventImage(URL.createObjectURL(file))
            }}
          />
          <button
            type="button"
            aria-label="Choose event image"
            onClick={() => imageInputRef.current?.click()}
            className="group relative aspect-square w-full overflow-hidden rounded-xl border border-outline bg-surface-container"
          >
            {eventImage ? (
              <img src={eventImage} alt="Event" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-muted transition-colors group-hover:text-on-surface-variant">
                <Icon name="add_photo_alternate" className="text-[40px]" />
              </span>
            )}
            <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center text-on-surface transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-110 group-active:translate-y-0 group-active:scale-95">
              <Icon
                name="photo_camera"
                className="icon-filled text-[22px] transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110"
              />
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div
            ref={titleRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Event Name"
            onInput={(event) => setTitleText(event.currentTarget.textContent ?? '')}
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
                      const startFloor = new Date(
                        startDate.getFullYear(),
                        startDate.getMonth(),
                        startDate.getDate(),
                      )
                      const disabled = picker === 'endDate' && cell < startFloor
                      return (
                        <button
                          key={cell.toISOString()}
                          type="button"
                          disabled={disabled}
                          onClick={() => pickDate(cell)}
                          className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                            disabled
                              ? 'cursor-not-allowed text-muted/30'
                              : selected
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
                <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-outline bg-surface-lowest shadow-float">
                  <TimePicker
                    value={picker === 'startTime' ? startTime : endTime}
                    onChange={(minutes) => {
                      if (picker === 'startTime') {
                        setStartTime(minutes)
                        if (sameDay(startDate, endDate) && endTime <= minutes) {
                          setEndTime(Math.min(minutes + 60, 24 * 60 - 5))
                        }
                      } else {
                        setEndTime(minutes)
                      }
                    }}
                  />
                </div>
              )}
            </div>
            <div ref={tzRef} className="relative shrink-0 sm:w-36">
              <button
                type="button"
                onClick={() => setTzOpen((open) => !open)}
                className="flex h-full w-full flex-col justify-center gap-1 rounded-xl border border-outline bg-surface-lowest px-4 py-3 text-left transition-colors hover:bg-surface-low"
              >
                <Icon name="globe" className="text-[18px] text-on-surface-variant" />
                <span className="text-sm font-medium text-on-surface">{timezone.offset}</span>
                <span className="text-xs text-muted">{timezone.city}</span>
              </button>
              {tzOpen && (
                <div className="absolute right-0 top-full z-20 mt-2 w-96 overflow-hidden rounded-xl border border-outline bg-surface-lowest shadow-float">
                  <input
                    autoFocus
                    type="text"
                    value={tzQuery}
                    onChange={(event) => setTzQuery(event.target.value)}
                    placeholder="Search for a timezone"
                    className="w-full border-b border-outline bg-transparent px-4 py-3 text-base text-on-surface placeholder:text-muted focus:outline-none"
                  />
                  <div className="max-h-72 overflow-y-auto p-1">
                    {matchedTimezones.map((zone) => (
                      <button
                        key={`${zone.label}-${zone.city}`}
                        type="button"
                        onClick={() => {
                          setTimezone(zone)
                          setTzOpen(false)
                          setTzQuery('')
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-low ${
                          timezone === zone ? 'bg-surface-low' : ''
                        }`}
                      >
                        <span className="text-sm font-medium text-on-surface">
                          {zone.label} - {zone.city}
                        </span>
                        <span className="text-sm text-muted">{zone.offset}</span>
                      </button>
                    ))}
                    {matchedTimezones.length === 0 && (
                      <p className="px-3 py-2.5 text-sm text-muted">No timezones found.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div ref={locationRef} className="relative">
            {locationOpen ? (
            <div className="flex w-full items-center gap-3 rounded-xl border border-outline bg-surface-lowest px-4 py-[21px]">
              <Icon name="location_on" className="text-[20px] text-on-surface-variant" />
              <input
                autoFocus
                type="text"
                value={locationQuery}
                onChange={(changeEvent) => setLocationQuery(changeEvent.target.value)}
                placeholder="Enter location or virtual link"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-on-surface placeholder:font-normal placeholder:text-muted focus:outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
              if (!locationOpen && location?.kind === 'place') setLocationQuery(location.name)
              setLocationOpen(!locationOpen)
            }}
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
          )}
            {locationOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-outline bg-surface-lowest shadow-float">
                <div className="max-h-72 overflow-y-auto p-2">
                  {locationQuery.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        chooseLocation({ kind: 'place', name: locationQuery.trim(), address: '' })
                      }
                      className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-low"
                    >
                      <Icon name="edit_location_alt" className="mt-0.5 text-[18px] text-muted" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-on-surface">
                          Use "{locationQuery.trim()}"
                        </span>
                        <span className="text-sm text-muted">Custom location</span>
                      </span>
                    </button>
                  )}
                  {canSearch && (
                    <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted">
                      Locations
                    </p>
                  )}
                  {places.map(
                    (place) => (
                      <button
                        key={`${place.name}-${place.address}`}
                        type="button"
                        onClick={() => chooseLocation({ kind: 'place', ...place })}
                        className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-low"
                      >
                        <Icon name="location_on" className="mt-0.5 text-[18px] text-muted" />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm font-semibold text-on-surface">
                            {place.name}
                          </span>
                          <span className="truncate text-sm text-muted">{place.address}</span>
                        </span>
                      </button>
                    ),
                  )}
                  {searching && <p className="px-2 py-2 text-sm text-muted">Searching…</p>}
                  {canSearch && !searching && places.length === 0 && (
                    <p className="px-2 py-2 text-sm text-muted">No locations found.</p>
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

          <button
            type="button"
            onClick={() => setDescOpen(true)}
            className="flex items-start gap-3 rounded-xl border border-outline bg-surface-lowest px-4 py-3 text-left transition-colors hover:bg-surface-low"
          >
            <Icon name="notes" className="mt-0.5 text-[20px] text-on-surface-variant" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                className={`text-sm ${descPreview ? 'font-semibold text-on-surface' : 'text-muted'}`}
              >
                {descPreview ? 'Event Description' : 'Add Description'}
              </span>
              {descPreview && (
                <span className="truncate text-sm text-muted">{descPreview}</span>
              )}
            </span>
          </button>

          {descOpen && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
              <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl border border-outline bg-surface-lowest shadow-float">
                <div className="flex items-center justify-between border-b border-outline px-5 py-4">
                  <h2 className="text-lg font-semibold text-on-surface">Event Description</h2>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={closeDescModal}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
                  >
                    <Icon name="close" className="text-[20px]" />
                  </button>
                </div>
                {/*
                  Mounted only while the modal is open, which is what makes the
                  editor's mount-time seeding line up with "the modal just
                  opened". Reopening it remounts and reseeds from descHtml.
                */}
                <RichTextEditor
                  initialHtml={descHtml}
                  onChange={setDescHtml}
                  placeholder="Describe your event..."
                  scrollable
                />
                <div className="flex justify-end border-t border-outline px-4 py-3">
                  <button
                    type="button"
                    onClick={closeDescModal}
                    className="rounded-lg bg-btn px-5 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {(saveError ?? loadError) && (
            <div className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
              <p>{(saveError ?? loadError)?.message}</p>
              {/* A 422 names the field it rejected, so say which one. */}
              {saveError?.fields.map((field) => (
                <p key={field.field} className="mt-1 font-normal">
                  {field.field}: {field.message}
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={saving || loadingEvent || titleText.trim() === ''}
            onClick={handleSubmit}
            className="w-full rounded-lg bg-btn py-3 text-base font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : isDraft
                ? 'Save Draft'
                : editingEvent
                  ? 'Save Changes'
                  : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  )
}
