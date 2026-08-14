import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import TimePicker from '../../components/TimePicker'
import { events, posts } from '../../data/mock'
import type { EventItem } from '../../data/mock'

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

const postedEvents = events.filter((event) =>
  ['Upcoming', 'Ongoing', 'Completed'].includes(event.status),
)

export default function NewPost() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editingPost = id ? posts.find((post) => post.id === Number(id)) : undefined

  const [images, setImages] = useState<string[]>([])
  const [selectedImage, setSelectedImage] = useState(0)
  const imagesInputRef = useRef<HTMLInputElement>(null)
  const thumbStripRef = useRef<HTMLDivElement>(null)

  function scrollThumbs(direction: -1 | 1) {
    const strip = thumbStripRef.current
    if (!strip) return
    strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' })
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, i) => i !== index))
    setSelectedImage((current) => Math.max(0, Math.min(current, images.length - 2)))
  }

  const viewerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  zoomRef.current = zoom

  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [selectedImage])

  function clampPan(x: number, y: number, z: number) {
    const el = viewerRef.current
    if (!el) return { x: 0, y: 0 }
    const maxX = (el.clientWidth * (z - 1)) / 2
    const maxY = (el.clientHeight * (z - 1)) / 2
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
  }

  const hasImages = images.length > 0
  useEffect(() => {
    if (!hasImages) return
    const el = viewerRef.current
    if (!el) return
    function onWheel(wheelEvent: WheelEvent) {
      wheelEvent.preventDefault()
      setZoom((current) => {
        const next = Math.min(4, Math.max(1, current * (1 - wheelEvent.deltaY * 0.002)))
        setPan((p) => (next === 1 ? { x: 0, y: 0 } : clampPan(p.x, p.y, next)))
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [hasImages])

  function startPan(mouseEvent: React.MouseEvent) {
    if (zoomRef.current <= 1) return
    mouseEvent.preventDefault()
    const start = { x: mouseEvent.clientX, y: mouseEvent.clientY, panX: pan.x, panY: pan.y }
    function move(ev: MouseEvent) {
      setPan(clampPan(start.panX + ev.clientX - start.x, start.panY + ev.clientY - start.y, zoomRef.current))
    }
    function up() {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const [postDate, setPostDate] = useState(() =>
    editingPost ? new Date(editingPost.date) : new Date(),
  )
  const [postTime, setPostTime] = useState(() => {
    const now = new Date()
    return Math.round((now.getHours() * 60 + now.getMinutes()) / 30) * 30 % (24 * 60)
  })
  const [useCurrentDate, setUseCurrentDate] = useState(() => !editingPost)
  const [datePicker, setDatePicker] = useState<'date' | 'time' | null>(null)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const dateRef = useRef<HTMLDivElement>(null)

  const [connectedEvent, setConnectedEvent] = useState<EventItem | null>(null)
  const [eventOpen, setEventOpen] = useState(false)
  const [eventQuery, setEventQuery] = useState('')
  const eventRef = useRef<HTMLDivElement>(null)

  const [isDraft, setIsDraft] = useState(() =>
    editingPost ? editingPost.status !== 'Posted' : false,
  )

  const matchedEvents = postedEvents.filter((event) =>
    `${event.name} ${event.location}`.toLowerCase().includes(eventQuery.trim().toLowerCase()),
  )

  function calendarCells() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(viewYear, viewMonth, i + 1 - firstDay))
    }
    return cells
  }

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      const target = event.target as Node
      if (!target.isConnected) return
      if (!dateRef.current?.contains(target)) setDatePicker(null)
      if (!eventRef.current?.contains(target)) setEventOpen(false)
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

  const [descOpen, setDescOpen] = useState(false)
  const [descHtml, setDescHtml] = useState(() =>
    editingPost ? `<p>${editingPost.description}</p>` : '',
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/posts')}
          className="flex items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" className="text-[20px]" />
          Back to Posts
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

      <div className="flex flex-col gap-4">
        <input
          ref={imagesInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (files.length === 0) return
            setImages((current) => {
              const next = [...current, ...files.map((file) => URL.createObjectURL(file))]
              if (current.length === 0) setSelectedImage(0)
              return next
            })
          }}
        />

        {images.length === 0 ? (
          <button
            type="button"
            onClick={() => imagesInputRef.current?.click()}
            className="group flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-strong bg-surface-lowest text-muted transition-colors hover:bg-surface-low hover:text-on-surface-variant"
          >
            <Icon name="add_photo_alternate" className="text-[40px]" />
            <span className="text-sm font-medium">Upload photos</span>
            <span className="text-xs">You can select multiple images</span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              ref={viewerRef}
              onMouseDown={startPan}
              className={`group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-outline bg-surface-container ${
                zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            >
              <img
                src={images[selectedImage]}
                alt={`Upload ${selectedImage + 1}`}
                onLoad={(loadEvent) => {
                  // landscape shots (4:3 and wider) zoom to fill; taller ones letterbox
                  const img = loadEvent.currentTarget
                  const ratio = img.naturalWidth / img.naturalHeight
                  img.style.objectFit = ratio >= 1.3 ? 'cover' : 'contain'
                }}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                className="h-full w-full object-contain"
                draggable={false}
              />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => removeImage(selectedImage)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
            <div className="relative">
              {images.length > 4 && (
                <button
                  type="button"
                  aria-label="Scroll thumbnails left"
                  onClick={() => scrollThumbs(-1)}
                  className="absolute -left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-float text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <Icon name="chevron_left" className="text-[22px]" />
                </button>
              )}
              <div ref={thumbStripRef} className="scrollbar-hide flex gap-2 overflow-x-auto">
                {images.map((src, index) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border transition-opacity ${
                      selectedImage === index
                        ? 'border-on-surface'
                        : 'border-outline opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={src} alt={`Thumbnail ${index + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Add more photos"
                  onClick={() => imagesInputRef.current?.click()}
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-outline-strong text-muted transition-colors hover:bg-surface-low hover:text-on-surface-variant"
                >
                  <Icon name="add" className="text-[26px]" />
                </button>
              </div>
              {images.length > 4 && (
                <button
                  type="button"
                  aria-label="Scroll thumbnails right"
                  onClick={() => scrollThumbs(1)}
                  className="absolute -right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-float text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <Icon name="chevron_right" className="text-[22px]" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <div ref={dateRef} className="relative flex-1">
            <button
              type="button"
              onClick={() => {
                const base = useCurrentDate ? new Date() : postDate
                setViewYear(base.getFullYear())
                setViewMonth(base.getMonth())
                setDatePicker(datePicker === 'date' ? null : 'date')
              }}
              className="flex h-full w-full items-center gap-3 rounded-xl border border-outline bg-surface-lowest px-4 py-3 text-left transition-colors hover:bg-surface-low"
            >
              <Icon name="calendar_month" className="text-[20px] text-on-surface-variant" />
              <span className="text-sm font-semibold text-on-surface">Post date</span>
              <span className="ml-auto flex items-center gap-1">
                {useCurrentDate ? (
                  <span className="rounded-md bg-surface-low px-2.5 py-1 text-sm text-on-surface">
                    Use current date
                  </span>
                ) : (
                  <>
                    <span className="rounded-md bg-surface-low px-2.5 py-1 text-sm text-on-surface">
                      {formatDay(postDate)}
                    </span>
                    <span
                      role="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation()
                        setDatePicker(datePicker === 'time' ? null : 'time')
                      }}
                      className="rounded-md bg-surface-low px-2.5 py-1 text-sm text-on-surface transition-colors hover:bg-surface-container"
                    >
                      {formatTime(postTime)}
                    </span>
                  </>
                )}
              </span>
            </button>
            {datePicker === 'date' && (
              <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-outline bg-surface-lowest p-4 shadow-float sm:bottom-full sm:top-auto sm:mb-2 sm:mt-0">
                <button
                  type="button"
                  onClick={() => {
                    setUseCurrentDate(true)
                    setDatePicker(null)
                  }}
                  className="mb-3 flex w-full items-center gap-2 rounded-lg bg-surface-low px-3 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                >
                  <Icon name="today" className="text-[18px]" />
                  Use current date
                  {useCurrentDate && <Icon name="check" className="ml-auto text-[16px]" />}
                </button>
                <div className="flex items-center justify-between">
                  <p className="text-base font-semibold text-on-surface">
                    {new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
                    const selected = !useCurrentDate && sameDay(cell, postDate)
                    const inMonth = cell.getMonth() === viewMonth
                    const today = sameDay(cell, new Date())
                    return (
                      <button
                        key={cell.toISOString()}
                        type="button"
                        onClick={() => {
                          setPostDate(cell)
                          setUseCurrentDate(false)
                          setDatePicker(null)
                        }}
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
            {datePicker === 'time' && (
              <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-outline bg-surface-lowest shadow-float sm:bottom-full sm:top-auto sm:mb-2 sm:mt-0">
                <TimePicker value={postTime} onChange={setPostTime} />
              </div>
            )}
          </div>

          <div ref={eventRef} className="relative flex-1">
            <button
              type="button"
              onClick={() => setEventOpen((open) => !open)}
              className="flex w-full items-start gap-3 rounded-xl border border-outline bg-surface-lowest px-4 py-3 text-left transition-colors hover:bg-surface-low"
            >
              <Icon name="event_available" className="mt-0.5 text-[20px] text-on-surface-variant" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`truncate text-sm ${
                    connectedEvent ? 'font-semibold text-on-surface' : 'font-semibold text-on-surface'
                  }`}
                >
                  {connectedEvent ? connectedEvent.name : 'Connect an Event'}
                </span>
                <span className="truncate text-sm text-muted">
                  {connectedEvent ? connectedEvent.date : 'Link this post to a live event'}
                </span>
              </span>
              {connectedEvent && (
                <span
                  role="button"
                  aria-label="Clear connected event"
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation()
                    setConnectedEvent(null)
                  }}
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  <Icon name="close" className="text-[18px]" />
                </span>
              )}
            </button>
            {eventOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-outline bg-surface-lowest shadow-float">
                <input
                  autoFocus
                  type="text"
                  value={eventQuery}
                  onChange={(changeEvent) => setEventQuery(changeEvent.target.value)}
                  placeholder="Search live events..."
                  className="w-full border-b border-outline bg-transparent px-4 py-3 text-base text-on-surface placeholder:text-muted focus:outline-none"
                />
                <div className="max-h-72 overflow-y-auto p-1">
                  {matchedEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => {
                        setConnectedEvent(event)
                        setEventOpen(false)
                        setEventQuery('')
                      }}
                      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-low ${
                        connectedEvent?.id === event.id ? 'bg-surface-low' : ''
                      }`}
                    >
                      <Icon name="calendar_month" className="mt-0.5 text-[18px] text-muted" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-on-surface">
                          {event.name}
                        </span>
                        <span className="truncate text-sm text-muted">
                          {event.date} · {event.location}
                        </span>
                      </span>
                    </button>
                  ))}
                  {matchedEvents.length === 0 && (
                    <p className="px-3 py-2.5 text-sm text-muted">No live events found.</p>
                  )}
                </div>
              </div>
            )}
          </div>
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
              {descPreview ? 'Post Description' : 'Add Description'}
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
                <h2 className="text-lg font-semibold text-on-surface">Post Description</h2>
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
                  data-placeholder="Describe your post..."
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
          onClick={() => navigate('/posts')}
          className="w-full rounded-lg bg-btn py-3 text-base font-semibold text-on-surface transition-opacity hover:opacity-85"
        >
          {isDraft ? 'Save Draft' : editingPost ? 'Save Changes' : 'Create Post'}
        </button>
      </div>
    </div>
  )
}
