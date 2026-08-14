import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { events } from '../../data/mock'

function parseTimeString(time: string): number | null {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return null
  let hours = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hours += 12
  return hours * 60 + Number(match[2])
}


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

export default function NewEvent() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editingEvent = id ? events.find((event) => event.id === Number(id)) : undefined
  const [startDate, setStartDate] = useState(() =>
    editingEvent ? new Date(editingEvent.date) : new Date(),
  )
  const [endDate, setEndDate] = useState(() =>
    editingEvent ? new Date(editingEvent.date) : new Date(),
  )
  const [startTime, setStartTime] = useState(
    () => (editingEvent && parseTimeString(editingEvent.time)) || 17 * 60 + 30,
  )
  const [endTime, setEndTime] = useState(
    () => (((editingEvent && parseTimeString(editingEvent.time)) || 17 * 60 + 30) + 60) % (24 * 60),
  )
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
  const imageInputRef = useRef<HTMLInputElement>(null)
  const dateCardRef = useRef<HTMLDivElement>(null)
  const locationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      const target = event.target as Node
      if (!target.isConnected) return
      if (!dateCardRef.current?.contains(target)) setPicker(null)
      if (!locationRef.current?.contains(target)) setLocationOpen(false)
      if (!tzRef.current?.contains(target)) setTzOpen(false)
      if (
        plusMenuOpenRef.current &&
        !plusMenuRef.current?.contains(target) &&
        !plusBtnRef.current?.contains(target)
      ) {
        setPlusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  const [timezone, setTimezone] = useState(timezones[0])
  const [tzOpen, setTzOpen] = useState(false)
  const [tzQuery, setTzQuery] = useState('')
  const tzRef = useRef<HTMLDivElement>(null)

  const matchedTimezones = timezones.filter((zone) =>
    `${zone.label} ${zone.city} ${zone.offset}`
      .toLowerCase()
      .includes(tzQuery.trim().toLowerCase()),
  )

  const [descOpen, setDescOpen] = useState(false)
  const [descHtml, setDescHtml] = useState(() =>
    editingEvent ? `<p>${editingEvent.description}</p>` : '',
  )
  const descRef = useRef<HTMLDivElement>(null)
  const [descToolbar, setDescToolbar] = useState<{ top: number; left: number } | null>(null)
  const [descLinkMode, setDescLinkMode] = useState(false)
  const [descLinkUrl, setDescLinkUrl] = useState('')
  const descRangeRef = useRef<Range | null>(null)
  const descLinkModeRef = useRef(false)
  descLinkModeRef.current = descLinkMode
  const [plusTop, setPlusTop] = useState<number | null>(null)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const plusMenuOpenRef = useRef(false)
  plusMenuOpenRef.current = plusMenuOpen
  const [plusMenuPos, setPlusMenuPos] = useState<{ left: number; top: number; up: boolean } | null>(null)
  const descScrollRef = useRef<HTMLDivElement>(null)
  const plusBtnRef = useRef<HTMLButtonElement>(null)
  const descImageInputRef = useRef<HTMLInputElement>(null)
  const descImageRangeRef = useRef<Range | null>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const plusRangeRef = useRef<Range | null>(null)

  const plusItems = [
    { icon: 'format_h1', label: 'Heading', action: () => descFormat('formatBlock', 'h3') },
    {
      icon: 'image',
      label: 'Image',
      action: () => {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          descImageRangeRef.current = selection.getRangeAt(0).cloneRange()
        }
        descImageInputRef.current?.click()
      },
    },
    { icon: 'format_h2', label: 'Subheading', action: () => descFormat('formatBlock', 'h4') },
    { icon: 'format_quote', label: 'Blockquote', action: () => descFormat('formatBlock', 'blockquote') },
    { icon: 'more_horiz', label: 'Divider', action: () => descFormat('insertHorizontalRule') },
    { icon: 'format_list_bulleted', label: 'List', action: () => descFormat('insertUnorderedList') },
    { icon: 'format_list_numbered', label: 'Numbered List', action: () => descFormat('insertOrderedList') },
  ]

  function runPlusItem(action: () => void) {
    const saved = plusRangeRef.current
    descRef.current?.focus()
    if (saved) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(saved)
      // collapse so block actions (lists, headings) apply to the current line only
      selection?.collapseToStart()
    }
    action()
    setPlusMenuOpen(false)
    plusRangeRef.current = null
  }

  useEffect(() => {
    if (!descOpen) return
    document.execCommand('defaultParagraphSeparator', false, 'p')
    const editor = descRef.current
    if (editor) {
      if (editor.innerHTML.trim() === '') {
        editor.innerHTML = '<p><br></p>'
      }
      editor.dataset.empty = (editor.textContent ?? '') === '' ? 'true' : 'false'
      editor.focus()
      const first = editor.firstChild
      if (first) {
        const range = document.createRange()
        range.selectNodeContents(first)
        range.collapse(true)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    }
    function onSelectionChange() {
      if (descLinkModeRef.current) return
      const selection = window.getSelection()
      if (
        selection &&
        !selection.isCollapsed &&
        selection.rangeCount > 0 &&
        descRef.current?.contains(selection.anchorNode)
      ) {
        const rect = selection.getRangeAt(0).getBoundingClientRect()
        setDescToolbar({ top: rect.top - 52, left: rect.left + rect.width / 2 })
      } else {
        setDescToolbar(null)
      }
      if (plusMenuOpenRef.current) return
      const editor = descRef.current
      if (
        editor &&
        selection &&
        selection.isCollapsed &&
        editor.contains(selection.anchorNode)
      ) {
        if ((editor.textContent ?? '') === '') {
          setPlusTop(editor.offsetTop + 20)
          return
        }
        let node: Node | null = selection.anchorNode
        while (node && node.parentNode !== editor) node = node.parentNode
        const block = node as HTMLElement | null
        if (block && block.nodeType === 1 && (block.textContent ?? '') === '') {
          setPlusTop(block.offsetTop + block.offsetHeight / 2 - 12)
        } else {
          setPlusTop(null)
        }
      } else {
        setPlusTop(null)
      }
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [descOpen])

  function descFormat(command: string, value?: string) {
    document.execCommand(command, false, value)
  }

  function descToggleBlock(tag: 'h3' | 'h4' | 'blockquote') {
    const selection = window.getSelection()
    let node: Node | null = selection?.anchorNode ?? null
    let current: string | null = null
    while (node) {
      const element = node as HTMLElement
      const tagName = element.tagName
      if (tagName === 'H3' || tagName === 'H4' || tagName === 'BLOCKQUOTE') {
        current = tagName
        break
      }
      if (element === descRef.current) break
      node = node.parentNode
    }
    descFormat('formatBlock', current === tag.toUpperCase() ? 'p' : tag)
  }

  function applyDescLink() {
    const url = descLinkUrl.trim()
    const saved = descRangeRef.current
    if (url && saved) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(saved)
      descFormat('createLink', url.startsWith('http') ? url : `https://${url}`)
    }
    setDescLinkMode(false)
    setDescLinkUrl('')
    descRangeRef.current = null
    setDescToolbar(null)
  }

  function ensureCaretBreathingRoom() {
    const scrollEl = descScrollRef.current
    const selection = window.getSelection()
    if (!scrollEl || !selection || selection.rangeCount === 0) return
    let rect = selection.getRangeAt(0).getBoundingClientRect()
    if (rect.height === 0 && rect.width === 0) {
      const node = selection.anchorNode
      const element =
        node && node.nodeType === 1 ? (node as HTMLElement) : node?.parentElement
      if (element) rect = element.getBoundingClientRect()
    }
    const containerRect = scrollEl.getBoundingClientRect()
    const breathingRoom = 16
    const overflow = rect.bottom - (containerRect.bottom - breathingRoom)
    if (overflow > 0) scrollEl.scrollTop += overflow
  }

  function handleDescKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') {
      const selection = window.getSelection()
      const editor = descRef.current
      if (!selection || !editor) return
      let node: Node | null = selection.anchorNode
      let listItem: HTMLElement | null = null
      while (node && node !== editor) {
        if ((node as HTMLElement).tagName === 'LI') {
          listItem = node as HTMLElement
          break
        }
        node = node.parentNode
      }
      if (listItem && (listItem.textContent ?? '') === '') {
        event.preventDefault()
        let list = listItem.closest('ul, ol')
        if (!list) return
        const parentItem = list.parentElement?.closest('li') as HTMLElement | null
        if (parentItem) {
          // empty sublist item: outdent into the outer list
          const newItem = document.createElement('li')
          newItem.innerHTML = '<br>'
          parentItem.after(newItem)
          listItem.remove()
          if (!list.querySelector('li')) list.remove()
          const range = document.createRange()
          range.selectNodeContents(newItem)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
          ensureCaretBreathingRoom()
          return
        }
        // normalize legacy nesting like <p><ul>...</ul></p>
        const wrapper = list.parentElement
        if (wrapper && wrapper !== editor && wrapper.tagName === 'P') {
          wrapper.replaceWith(list)
        }
        const paragraph = document.createElement('p')
        paragraph.innerHTML = '<br>'
        list.parentNode?.insertBefore(paragraph, list.nextSibling)
        listItem.remove()
        if ((list.textContent ?? '') === '') list.remove()
        const range = document.createRange()
        range.selectNodeContents(paragraph)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        ensureCaretBreathingRoom()
        return
      }
      if (listItem) return
      let styled: Node | null = selection.anchorNode
      let effectBlock: HTMLElement | null = null
      while (styled && styled !== editor) {
        const tagName = (styled as HTMLElement).tagName
        if (tagName === 'H3' || tagName === 'H4' || tagName === 'BLOCKQUOTE') {
          effectBlock = styled as HTMLElement
          break
        }
        styled = styled.parentNode
      }
      if (effectBlock) {
        // new line after a styled block starts plain — don't inherit the effect
        event.preventDefault()
        document.execCommand('insertParagraph')
        document.execCommand('formatBlock', false, 'p')
      }
      return
    }
    if (event.key === 'Backspace') {
      const selection = window.getSelection()
      const editor = descRef.current
      if (!selection || !editor) return
      let liNode: Node | null = selection.anchorNode
      let listItem: HTMLElement | null = null
      while (liNode && liNode !== editor) {
        if ((liNode as HTMLElement).tagName === 'LI') {
          listItem = liNode as HTMLElement
          break
        }
        liNode = liNode.parentNode
      }
      if (listItem && (listItem.textContent ?? '') === '') {
        event.preventDefault()
        const list = listItem.closest('ul, ol')
        if (!list) return
        const previousItem = listItem.previousElementSibling as HTMLElement | null
        const parentItem = list.parentElement?.closest('li') as HTMLElement | null
        let caretTarget: HTMLElement | null = null
        if (!parentItem && previousItem) {
          // top-level: turn the empty item into a bulleted sublist of the item above
          const sublist = document.createElement('ul')
          const subItem = document.createElement('li')
          subItem.innerHTML = '<br>'
          sublist.appendChild(subItem)
          previousItem.appendChild(sublist)
          listItem.remove()
          caretTarget = subItem
        } else {
          // nested (or first item): remove and step back out
          listItem.remove()
          if ((list.textContent ?? '') === '' && !list.querySelector('li')) {
            if (parentItem) {
              list.remove()
              caretTarget = parentItem
            } else {
              const paragraph = document.createElement('p')
              paragraph.innerHTML = '<br>'
              list.replaceWith(paragraph)
              caretTarget = paragraph
            }
          } else {
            caretTarget = previousItem ?? parentItem
          }
        }
        if (caretTarget) {
          const range = document.createRange()
          range.selectNodeContents(caretTarget)
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)
        }
        return
      }
      let node: Node | null = selection.anchorNode
      while (node && node !== editor) {
        const tagName = (node as HTMLElement).tagName
        if (tagName === 'BLOCKQUOTE' || tagName === 'H3' || tagName === 'H4') {
          if (((node as HTMLElement).textContent ?? '') === '') {
            event.preventDefault()
            document.execCommand('formatBlock', false, 'p')
          }
          return
        }
        node = node.parentNode
      }
      return
    }
    if (event.key === ' ') {
      const selection = window.getSelection()
      const editor = descRef.current
      if (!selection || !editor) return
      let node: Node | null = selection.anchorNode
      while (node && node.parentNode !== editor) node = node.parentNode
      const block = (node as HTMLElement | null) ?? editor
      const trigger = block.textContent ?? ''
      if (trigger === '-' || trigger === '1.') {
        event.preventDefault()
        // build the list directly — execCommand nests it inside the paragraph
        const list = document.createElement(trigger === '-' ? 'ul' : 'ol')
        const item = document.createElement('li')
        item.innerHTML = '<br>'
        list.appendChild(item)
        if (block === editor) {
          editor.innerHTML = ''
          editor.appendChild(list)
        } else {
          block.replaceWith(list)
        }
        const range = document.createRange()
        range.selectNodeContents(item)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }

  function closeDescModal() {
    setDescHtml(descRef.current?.innerHTML ?? descHtml)
    setDescOpen(false)
    setDescToolbar(null)
    setDescLinkMode(false)
  }

  const descPreview = descHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

  const descToolbarButton =
    'flex h-9 w-9 items-center justify-center rounded text-white transition-opacity hover:opacity-70'

  const [locationOpen, setLocationOpen] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [location, setLocation] = useState<
    { kind: 'place'; name: string; address: string } | { kind: 'virtual' } | null
  >(() => {
    if (!editingEvent) return null
    if (['Virtual', 'Discord'].includes(editingEvent.location)) return { kind: 'virtual' }
    return { kind: 'place', name: editingEvent.location, address: '' }
  })

  const [searchResults, setSearchResults] = useState<
    { name: string; address: string }[]
  >([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const query = locationQuery.trim()
    if (query.length < 3) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?limit=6&lat=7.07&lon=125.61&q=${encodeURIComponent(query)}`,
        )
        const data: {
          features: {
            properties: {
              name?: string
              housenumber?: string
              street?: string
              district?: string
              city?: string
              state?: string
              country?: string
            }
          }[]
        } = await response.json()
        setSearchResults(
          data.features
            .filter((feature) => feature.properties.name)
            .map((feature) => {
              const props = feature.properties
              const address = [
                [props.housenumber, props.street].filter(Boolean).join(' '),
                props.district,
                props.city,
                props.state,
                props.country,
              ]
                .filter(Boolean)
                .join(', ')
              return { name: props.name as string, address }
            }),
        )
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [locationQuery])

  function chooseLocation(choice: { kind: 'place'; name: string; address: string } | { kind: 'virtual' }) {
    setLocation(choice)
    setLocationOpen(false)
    setLocationQuery('')
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
            ref={(node) => {
              if (node && node.dataset.init !== 'true') {
                node.dataset.init = 'true'
                if (editingEvent) node.textContent = editingEvent.name
              }
            }}
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
                  {locationQuery.trim().length >= 3 && (
                    <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted">
                      Locations
                    </p>
                  )}
                  {(locationQuery.trim().length < 3 ? [] : searchResults).map(
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
                  {locationQuery.trim().length >= 3 && searching && (
                    <p className="px-2 py-2 text-sm text-muted">Searching…</p>
                  )}
                  {locationQuery.trim().length >= 3 &&
                    !searching &&
                    searchResults.length === 0 && (
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
                <input
                  ref={descImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    const url = URL.createObjectURL(file)
                    descRef.current?.focus()
                    const saved = descImageRangeRef.current
                    const selection = window.getSelection()
                    if (saved && selection) {
                      selection.removeAllRanges()
                      selection.addRange(saved)
                    }
                    document.execCommand('insertImage', false, url)
                    const editor = descRef.current
                    const image = editor
                      ? Array.from(editor.querySelectorAll('img')).find(
                          (element) => element.src === url,
                        )
                      : null
                    if (image && editor) {
                      let block: HTMLElement = image
                      while (block.parentElement && block.parentElement !== editor) {
                        block = block.parentElement
                      }
                      const paragraph = document.createElement('p')
                      paragraph.innerHTML = '<br>'
                      block.after(paragraph)
                      const range = document.createRange()
                      range.selectNodeContents(paragraph)
                      range.collapse(true)
                      const sel = window.getSelection()
                      sel?.removeAllRanges()
                      sel?.addRange(range)
                    }
                    descImageRangeRef.current = null
                  }}
                />
                <div ref={descScrollRef} className="relative flex-1 overflow-y-auto">
                  {plusTop !== null && (
                    <button
                      ref={plusBtnRef}
                      type="button"
                      aria-label="Insert block"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        const selection = window.getSelection()
                        if (selection && selection.rangeCount > 0) {
                          plusRangeRef.current = selection.getRangeAt(0).cloneRange()
                        }
                        const rect = event.currentTarget.getBoundingClientRect()
                        const up = window.innerHeight - rect.bottom < 300
                        setPlusMenuPos({
                          left: rect.left,
                          top: up ? rect.top - 6 : rect.bottom + 6,
                          up,
                        })
                        setPlusMenuOpen((open) => !open)
                      }}
                      className={`absolute left-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-outline-strong text-muted transition-transform hover:text-on-surface ${
                        plusMenuOpen ? 'rotate-45' : ''
                      }`}
                      style={{ top: plusTop }}
                    >
                      <Icon name="add" className="text-[15px]" />
                    </button>
                  )}
                  {plusMenuOpen && plusMenuPos && (
                    <div
                      ref={plusMenuRef}
                      className={`fixed z-50 w-64 overflow-hidden rounded-xl border border-outline bg-surface-lowest shadow-float ${
                        plusMenuPos.up ? '-translate-y-full' : ''
                      }`}
                      style={{ top: plusMenuPos.top, left: plusMenuPos.left }}
                    >
                      <div className="p-1">
                        {plusItems.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              runPlusItem(item.action)
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-low"
                          >
                            <Icon name={item.icon} className="text-[18px] text-on-surface-variant" />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div
                    ref={(node) => {
                      descRef.current = node
                      // initialize once per mount; rewriting on re-render wipes live edits
                      if (node && node.dataset.mounted !== 'true') {
                        node.dataset.mounted = 'true'
                        node.innerHTML = descHtml
                      }
                    }}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Describe your event..."
                    onKeyDown={handleDescKeyDown}
                    onInput={(event) => {
                      const el = event.target as HTMLElement
                      const empty = (el.textContent ?? '') === ''
                      const inputType = (event.nativeEvent as InputEvent).inputType ?? ''
                      // select-all + delete leaves husks like <ul><li><br></li></ul>;
                      // only clean on deletions or the reset would eat new empty lists
                      if (
                        empty &&
                        inputType.startsWith('delete') &&
                        el.querySelector('ul, ol, li, hr, h3, h4, blockquote')
                      ) {
                        el.innerHTML = '<p><br></p>'
                        const range = document.createRange()
                        range.selectNodeContents(el.firstChild as Node)
                        range.collapse(true)
                        const selection = window.getSelection()
                        selection?.removeAllRanges()
                        selection?.addRange(range)
                      }
                      el.dataset.empty = empty ? 'true' : 'false'
                      requestAnimationFrame(ensureCaretBreathingRoom)
                    }}
                    className="editor-block desc-editor relative min-h-64 pb-4 pl-12 pr-5 pt-4 text-base leading-relaxed text-on-surface focus:outline-none"
                  />
                </div>
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
              {descToolbar && descLinkMode && (
                <div
                  className="fixed z-50 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-inverse-surface px-2 py-1.5 shadow-float"
                  style={{ top: descToolbar.top, left: descToolbar.left }}
                >
                  <input
                    autoFocus
                    type="text"
                    value={descLinkUrl}
                    onChange={(event) => setDescLinkUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyDescLink()
                      if (event.key === 'Escape') {
                        setDescLinkMode(false)
                        setDescLinkUrl('')
                      }
                    }}
                    placeholder="Paste or type a link..."
                    className="w-64 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Cancel link"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      setDescLinkMode(false)
                      setDescLinkUrl('')
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded text-white transition-opacity hover:opacity-70"
                  >
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>
              )}
              {descToolbar && !descLinkMode && (
                <div
                  className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-lg bg-inverse-surface px-1.5 py-1 shadow-float"
                  style={{ top: descToolbar.top, left: descToolbar.left }}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); descToggleBlock('h3') }}
                    className={descToolbarButton}
                  >
                    <span className="text-sm font-bold">H1</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); descToggleBlock('h4') }}
                    className={descToolbarButton}
                  >
                    <span className="text-sm font-bold">H2</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); descFormat('bold') }}
                    className={descToolbarButton}
                  >
                    <Icon name="format_bold" className="text-[20px]" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); descFormat('italic') }}
                    className={descToolbarButton}
                  >
                    <Icon name="format_italic" className="text-[20px]" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      const selection = window.getSelection()
                      if (selection && selection.rangeCount > 0) {
                        descRangeRef.current = selection.getRangeAt(0).cloneRange()
                      }
                      setDescLinkMode(true)
                    }}
                    className={descToolbarButton}
                  >
                    <Icon name="link" className="text-[20px]" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); descToggleBlock('blockquote') }}
                    className={descToolbarButton}
                  >
                    <Icon name="format_quote" className="text-[20px]" />
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/events')}
            className="w-full rounded-lg bg-btn py-3 text-base font-semibold text-on-surface transition-opacity hover:opacity-85"
          >
            {editingEvent ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  )
}
