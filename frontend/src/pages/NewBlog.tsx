import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'

type Block =
  | { id: number; type: 'text'; html: string }
  | { id: number; type: 'media'; kind: 'image' | 'video'; src: string }
  | { id: number; type: 'divider' }
  | { id: number; type: 'link'; url: string }
  | { id: number; type: 'embed'; url: string }

let nextId = 1
function newTextBlock(): Block {
  return { id: nextId++, type: 'text', html: '' }
}

type TextBlockViewProps = {
  blockId: number
  initialHtml: string
  placeholder: string
  onFocus: () => void
  onBlur: () => void
  onInput: (html: string) => void
  onKeyDown: (event: React.KeyboardEvent) => void
  hideCaret: boolean
}

function TextBlockView({
  blockId,
  initialHtml,
  placeholder,
  onFocus,
  onBlur,
  onInput,
  onKeyDown,
  hideCaret,
}: TextBlockViewProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml
    }
    // set only on mount — re-writing innerHTML on every keystroke resets the caret
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      data-block-id={blockId}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      onInput={(event) => onInput((event.target as HTMLElement).innerHTML)}
      onKeyDown={onKeyDown}
      className={`editor-block w-full text-lg leading-relaxed text-on-surface focus:outline-none ${
        hideCaret ? 'caret-transparent' : ''
      }`}
    />
  )
}

function embedSrc(url: string) {
  const full = url.startsWith('http') ? url : `https://${url}`
  const yt = full.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = full.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return full
}

function domainOf(url: string) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
  } catch {
    return url
  }
}

export default function NewBlog() {
  const navigate = useNavigate()
  const [blocks, setBlocks] = useState<Block[]>([newTextBlock()])
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [linkInputId, setLinkInputId] = useState<number | null>(null)
  const [linkKind, setLinkKind] = useState<'video' | 'link'>('link')
  const [linkDraft, setLinkDraft] = useState('')
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null)
  const [toolbarLink, setToolbarLink] = useState(false)
  const [toolbarUrl, setToolbarUrl] = useState('')
  const savedRangeRef = useRef<Range | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const toolbarLinkRef = useRef(false)
  toolbarLinkRef.current = toolbarLink
  const [action, setAction] = useState<'Publish' | 'Save Draft'>('Publish')
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [dragId, setDragId] = useState<number | null>(null)
  const [hero, setHero] = useState<Block | null>(null)
  const [titleFocused, setTitleFocused] = useState(false)
  const [titleEmpty, setTitleEmpty] = useState(true)
  const [titleMenuOpen, setTitleMenuOpen] = useState(false)
  const [titleLinkInput, setTitleLinkInput] = useState(false)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const titleAreaRef = useRef<HTMLDivElement>(null)
  const focusNextRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadRef = useRef<{ blockId: number; kind: 'image' | 'video' } | null>(null)
  const dragIdRef = useRef<number | null>(null)
  const dropIndexRef = useRef<number | null>(null)

  useEffect(() => {
    if (focusNextRef.current !== null) {
      const el = editorRef.current?.querySelector<HTMLElement>(
        `[data-block-id="${focusNextRef.current}"]`,
      )
      if (el) {
        el.focus()
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      focusNextRef.current = null
    }
  })

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      const target = event.target as Node
      // a click can unmount its own target (menu button -> input swap); a detached
      // node is never "outside" the editor
      if (!target.isConnected) return
      if (!editorRef.current?.contains(target)) {
        setMenuOpenId(null)
        setLinkInputId(null)
        setFocusedId(null)
      }
      if (!titleAreaRef.current?.contains(target)) {
        setTitleMenuOpen(false)
        setTitleLinkInput(false)
        setTitleFocused(false)
      }
      if (toolbarLinkRef.current && !toolbarRef.current?.contains(target)) {
        setToolbarLink(false)
        setToolbarUrl('')
        savedRangeRef.current = null
        setToolbar(null)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  function updateHtml(id: number, html: string) {
    if (menuOpenId === id && html.replace(/<[^>]*>/g, '') !== '') {
      setMenuOpenId(null)
      setLinkInputId(null)
    }
    setBlocks((list) =>
      list.map((block) => (block.id === id && block.type === 'text' ? { ...block, html } : block)),
    )
  }

  function insertAfter(id: number, ...added: Block[]) {
    setBlocks((list) => {
      const index = list.findIndex((block) => block.id === id)
      return [...list.slice(0, index + 1), ...added, ...list.slice(index + 1)]
    })
  }

  function removeBlock(id: number) {
    setBlocks((list) => {
      const filtered = list.filter((block) => block.id !== id)
      return filtered.length ? filtered : [newTextBlock()]
    })
  }

  function moveToIndex(sourceId: number, insertionIndex: number) {
    setBlocks((list) => {
      const from = list.findIndex((block) => block.id === sourceId)
      if (from < 0) return list
      let to = insertionIndex
      if (to > from) to -= 1
      if (to === from) return list
      const copy = [...list]
      const [moved] = copy.splice(from, 1)
      copy.splice(to, 0, moved)
      return copy
    })
  }

  function handleKeyDown(event: React.KeyboardEvent, block: Block) {
    if (event.key === ' ' && block.type === 'text') {
      const el = event.target as HTMLElement
      if (el.textContent === '-') {
        event.preventDefault()
        el.innerHTML = ''
        document.execCommand('insertUnorderedList')
        updateHtml(block.id, el.innerHTML)
        return
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      const el = event.currentTarget as HTMLElement
      const selection = window.getSelection()
      let node = selection?.anchorNode ?? null
      let listItem: HTMLElement | null = null
      while (node && node !== el) {
        if ((node as HTMLElement).tagName === 'LI') {
          listItem = node as HTMLElement
          break
        }
        node = node.parentNode
      }
      if (listItem) {
        if ((listItem.textContent ?? '') !== '') {
          return
        }
        event.preventDefault()
        listItem.remove()
        el.querySelectorAll('ul').forEach((list) => {
          if (!list.textContent) list.remove()
        })
        updateHtml(block.id, el.innerHTML)
        const added = newTextBlock()
        focusNextRef.current = added.id
        insertAfter(block.id, added)
        return
      }
      event.preventDefault()
      const added = newTextBlock()
      focusNextRef.current = added.id
      insertAfter(block.id, added)
      setMenuOpenId(null)
    }
    if (event.key === 'Backspace' && block.type === 'text') {
      const index = blocks.findIndex((item) => item.id === block.id)
      const previous = blocks[index - 1]
      const isEmptyBlock = (event.target as HTMLElement).textContent === ''
      if (isEmptyBlock && blocks.length > 1) {
        event.preventDefault()
        if (previous && previous.type !== 'text') {
          removeBlock(previous.id)
        } else if (previous?.type === 'text') {
          focusNextRef.current = previous.id
          removeBlock(block.id)
        } else {
          removeBlock(block.id)
        }
        return
      }
      const selection = window.getSelection()
      if (
        selection &&
        selection.isCollapsed &&
        selection.anchorOffset === 0 &&
        previous &&
        previous.type !== 'text'
      ) {
        event.preventDefault()
        removeBlock(previous.id)
      }
    }
  }

  function handleSelect() {
    if (toolbarLink) return
    const selection = window.getSelection()
    if (
      selection &&
      !selection.isCollapsed &&
      selection.rangeCount > 0 &&
      editorRef.current?.contains(selection.anchorNode)
    ) {
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      setToolbar({ top: rect.top - 52, left: rect.left + rect.width / 2 })
    } else {
      setToolbar(null)
    }
  }

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelect)
    return () => document.removeEventListener('selectionchange', handleSelect)
  })

  function format(command: string, value?: string) {
    document.execCommand(command, false, value)
  }

  function toggleBlockTag(tag: 'h3' | 'h4' | 'blockquote') {
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
      if (element.classList?.contains('editor-block')) break
      node = node.parentNode
    }
    format('formatBlock', current === tag.toUpperCase() ? 'p' : tag)
  }

  function applyToolbarLink() {
    const url = toolbarUrl.trim()
    const saved = savedRangeRef.current
    if (url && saved) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(saved)
      format('createLink', url.startsWith('http') ? url : `https://${url}`)
    }
    setToolbarLink(false)
    setToolbarUrl('')
    savedRangeRef.current = null
    setToolbar(null)
  }

  function pickMedia(id: number, kind: 'image' | 'video') {
    pendingUploadRef.current = { blockId: id, kind }
    if (fileInputRef.current) {
      fileInputRef.current.accept = kind === 'image' ? 'image/*' : 'video/*'
      fileInputRef.current.click()
    }
  }

  function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const pending = pendingUploadRef.current
    event.target.value = ''
    if (!file || !pending) return
    const src = URL.createObjectURL(file)
    if (pending.blockId === -1) {
      setHero({ id: nextId++, type: 'media', kind: pending.kind, src })
      setTitleMenuOpen(false)
    } else {
      const added = newTextBlock()
      focusNextRef.current = added.id
      insertAfter(pending.blockId, { id: nextId++, type: 'media', kind: pending.kind, src }, added)
      setMenuOpenId(null)
      removeBlock(pending.blockId)
    }
    pendingUploadRef.current = null
  }

  function addTitleLink() {
    if (!linkDraft.trim()) return
    setHero({ id: nextId++, type: 'link', url: linkDraft.trim() })
    setLinkDraft('')
    setTitleLinkInput(false)
    setTitleMenuOpen(false)
  }

  function addDivider(id: number) {
    const added = newTextBlock()
    focusNextRef.current = added.id
    insertAfter(id, { id: nextId++, type: 'divider' }, added)
    setMenuOpenId(null)
    removeBlock(id)
  }

  function addLink(id: number) {
    if (!linkDraft.trim()) return
    const added = newTextBlock()
    focusNextRef.current = added.id
    const url = linkDraft.trim()
    insertAfter(
      id,
      linkKind === 'video'
        ? { id: nextId++, type: 'embed', url }
        : { id: nextId++, type: 'link', url },
      added,
    )
    setLinkDraft('')
    setLinkInputId(null)
    setMenuOpenId(null)
    removeBlock(id)
  }

  function dragProps(block: Block) {
    return { 'data-wrap-id': block.id }
  }

  function startDrag(blockId: number, startEvent: React.MouseEvent) {
    startEvent.preventDefault()
    dragIdRef.current = blockId
    dropIndexRef.current = null
    setDragId(blockId)
    function onMove(event: MouseEvent) {
      const wrappers = Array.from(
        editorRef.current?.querySelectorAll<HTMLElement>('[data-wrap-id]') ?? [],
      )
      let index = wrappers.length
      for (let i = 0; i < wrappers.length; i++) {
        const rect = wrappers[i].getBoundingClientRect()
        if (event.clientY < rect.top + rect.height / 2) {
          index = i
          break
        }
      }
      dropIndexRef.current = index
      setDropIndex(index)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const source = dragIdRef.current
      const index = dropIndexRef.current
      if (source !== null && index !== null) {
        moveToIndex(source, index)
      }
      dragIdRef.current = null
      dropIndexRef.current = null
      setDragId(null)
      setDropIndex(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function DragHandle({ blockId }: { blockId: number }) {
    return (
      <span
        onMouseDown={(event) => startDrag(blockId, event)}
        className={`absolute left-2 top-1/2 z-10 h-9 w-9 -translate-y-1/2 cursor-grab select-none items-center justify-center rounded-full text-muted hover:text-on-surface active:cursor-grabbing ${
          dragId === blockId ? 'flex' : 'hidden group-hover:flex'
        }`}
      >
        <Icon name="drag_indicator" className="text-[20px]" />
      </span>
    )
  }

  const menuButton =
    'flex h-9 w-9 items-center justify-center rounded-full border border-outline text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface'
  const toolbarButton =
    'flex h-9 w-9 items-center justify-center rounded text-white transition-opacity hover:opacity-70'
  const dropHighlight = (blockIndex: number) => {
    if (dragId === null || dropIndex === null) return ''
    if (dropIndex === blockIndex) return 'border-t-2 border-primary'
    if (dropIndex === blocks.length && blockIndex === blocks.length - 1) {
      return 'border-b-2 border-primary'
    }
    return ''
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/blogs')}
          className="flex items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" className="text-[20px]" />
          Back to Blogs
        </button>
        <div className="relative flex rounded-lg transition-colors hover:bg-btn">
          <button
            type="button"
            onClick={() => navigate('/blogs')}
            className="w-24 py-2 pl-2 text-center text-sm font-semibold text-on-surface"
          >
            {action}
          </button>
          <button
            type="button"
            aria-label="Change action"
            onClick={() => setActionMenuOpen((open) => !open)}
            className="flex items-center pr-2 text-on-surface"
          >
            <Icon name="expand_more" className="text-[18px]" />
          </button>
          {actionMenuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
              {(['Publish', 'Save Draft'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setAction(option)
                    setActionMenuOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-low ${
                    action === option ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {option}
                  {action === option && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={titleAreaRef} className="flex flex-col gap-4">
        {hero && hero.type === 'media' && (
          <div className="group relative">
            {hero.kind === 'image' ? (
              <img
                src={hero.src}
                alt=""
                className="w-full border border-outline object-cover"
              />
            ) : (
              <video src={hero.src} controls className="w-full border border-outline" />
            )}
          </div>
        )}
        {hero && hero.type === 'link' && (
          <div className="group relative">
            <a
              href={hero.url.startsWith('http') ? hero.url : `https://${hero.url}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-36 overflow-hidden border border-outline bg-surface-lowest transition-shadow hover:shadow-float"
            >
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-6">
                <p className="truncate text-lg font-semibold text-on-surface">
                  {domainOf(hero.url)}
                </p>
                <p className="truncate text-base text-on-surface-variant">{hero.url}</p>
                <p className="mt-1 truncate text-sm text-muted">{domainOf(hero.url)}</p>
              </div>
              <div className="flex h-full w-36 shrink-0 items-center justify-center bg-surface-low text-muted">
                <Icon name="link" className="text-[28px]" />
              </div>
            </a>
          </div>
        )}
        <div className="relative -ml-12 pl-12">
          {titleEmpty && titleFocused && !hero && (
            <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center">
              <button
                type="button"
                aria-label="Add header media"
                onMouseDown={(event) => {
                  event.preventDefault()
                  setTitleMenuOpen((open) => !open)
                  setTitleLinkInput(false)
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-outline-strong text-on-surface-variant transition-transform hover:text-on-surface ${
                  titleMenuOpen ? 'rotate-45' : ''
                }`}
              >
                <Icon name="add" className="text-[22px]" />
              </button>
            </div>
          )}
          {titleMenuOpen && (
            <div className="absolute left-11 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {titleLinkInput ? (
                <input
                  autoFocus
                  type="text"
                  value={linkDraft}
                  onChange={(event) => setLinkDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addTitleLink()
                    if (event.key === 'Escape') setTitleLinkInput(false)
                  }}
                  placeholder="Paste a link and press Enter"
                  className="w-72 rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
                />
              ) : (
                <>
                  <button
                    type="button"
                    aria-label="Add image"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      pickMedia(-1, 'image')
                    }}
                    className={menuButton}
                  >
                    <Icon name="image" className="text-[19px]" />
                  </button>
                  <button
                    type="button"
                    aria-label="Add video"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      pickMedia(-1, 'video')
                    }}
                    className={menuButton}
                  >
                    <Icon name="smart_display" className="text-[19px]" />
                  </button>
                  <button
                    type="button"
                    aria-label="Add link"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      setTitleLinkInput(true)
                    }}
                    className={menuButton}
                  >
                    <Icon name="link" className="text-[19px]" />
                  </button>
                </>
              )}
            </div>
          )}
          <div
            contentEditable
            suppressContentEditableWarning
            data-placeholder={titleMenuOpen ? '' : 'Title'}
            onFocus={() => setTitleFocused(true)}
            onInput={(event) => {
              const text = (event.target as HTMLElement).textContent ?? ''
              setTitleEmpty(text === '')
              if (text !== '') {
                setTitleMenuOpen(false)
                setTitleLinkInput(false)
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                const first = blocks.find((item) => item.type === 'text')
                if (first) {
                  focusNextRef.current = first.id
                  setBlocks((list) => [...list])
                }
              }
              if (event.key === 'Backspace' && hero) {
                const selection = window.getSelection()
                if (selection && selection.isCollapsed && selection.anchorOffset === 0) {
                  event.preventDefault()
                  setHero(null)
                }
              }
            }}
            className={`title-block w-full whitespace-pre-wrap break-words bg-transparent text-[2rem] font-bold leading-tight tracking-tight text-on-surface focus:outline-none ${
              titleMenuOpen ? 'caret-transparent' : ''
            }`}
          />
        </div>
      </div>

      <div ref={editorRef} className="flex flex-col gap-5 pb-24">
        {blocks.map((block, blockIndex) => {
          if (block.type === 'text') {
            const isEmpty = block.html.replace(/<[^>]*>/g, '') === ''
            const showPlus = isEmpty && focusedId === block.id
            return (
              <div
                key={block.id}
                className={`group relative -ml-12 pl-12 ${dropHighlight(blockIndex)}`}
                {...dragProps(block)}
              >
                {!isEmpty && <DragHandle blockId={block.id} />}
                {showPlus && (
                  <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center">
                    <button
                      type="button"
                      aria-label="Add block"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        setMenuOpenId(menuOpenId === block.id ? null : block.id)
                        setLinkInputId(null)
                      }}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border border-outline-strong text-on-surface-variant transition-transform hover:text-on-surface ${
                        menuOpenId === block.id ? 'rotate-45' : ''
                      }`}
                    >
                      <Icon name="add" className="text-[22px]" />
                    </button>
                  </div>
                )}
                {menuOpenId === block.id && (
                  <div className="absolute left-11 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {linkInputId === block.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={linkDraft}
                        onChange={(event) => setLinkDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') addLink(block.id)
                          if (event.key === 'Escape') setLinkInputId(null)
                        }}
                        placeholder={
                          linkKind === 'video'
                            ? 'Paste a YouTube, Vimeo, or other video link, and press Enter'
                            : 'Paste a link, and press Enter'
                        }
                        className="w-[36rem] max-w-[80vw] bg-transparent text-lg text-on-surface placeholder:text-muted focus:outline-none"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label="Add image"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            pickMedia(block.id, 'image')
                          }}
                          className={menuButton}
                        >
                          <Icon name="image" className="text-[19px]" />
                        </button>
                        <button
                          type="button"
                          aria-label="Add video"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            setLinkKind('video')
                            setLinkInputId(block.id)
                          }}
                          className={menuButton}
                        >
                          <Icon name="smart_display" className="text-[19px]" />
                        </button>
                        <button
                          type="button"
                          aria-label="Add link"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            setLinkKind('link')
                            setLinkInputId(block.id)
                          }}
                          className={menuButton}
                        >
                          <Icon name="link" className="text-[19px]" />
                        </button>
                        <button
                          type="button"
                          aria-label="Add divider"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            addDivider(block.id)
                          }}
                          className={menuButton}
                        >
                          <Icon name="more_horiz" className="text-[19px]" />
                        </button>
                      </>
                    )}
                  </div>
                )}
                <TextBlockView
                  blockId={block.id}
                  initialHtml={block.html}
                  placeholder={
                    blocks.length === 1 && isEmpty && menuOpenId !== block.id
                      ? 'Tell your story...'
                      : ''
                  }
                  onFocus={() => {
                    setFocusedId(block.id)
                    setMenuOpenId((current) => (current === block.id ? current : null))
                  }}
                  onBlur={() => {
                    if (menuOpenId !== block.id) {
                      setFocusedId((current) => (current === block.id ? null : current))
                    }
                  }}
                  onInput={(html) => updateHtml(block.id, html)}
                  onKeyDown={(event) => handleKeyDown(event, block)}
                  hideCaret={menuOpenId === block.id}
                />
              </div>
            )
          }
          if (block.type === 'media') {
            return (
              <div
                key={block.id}
                className={`group relative -ml-12 pl-12 ${dropHighlight(blockIndex)}`}
                {...dragProps(block)}
              >
                <DragHandle blockId={block.id} />
                {block.kind === 'image' ? (
                  <img
                    src={block.src}
                    alt=""
                    className="w-full border border-outline object-cover"
                  />
                ) : (
                  <video src={block.src} controls className="w-full border border-outline" />
                )}
              </div>
            )
          }
          if (block.type === 'divider') {
            return (
              <div
                key={block.id}
                className={`group relative -ml-12 flex items-center justify-center gap-3 py-2 pl-12 ${dropHighlight(blockIndex)}`}
                {...dragProps(block)}
              >
                <DragHandle blockId={block.id} />
                <span className="h-1 w-1 rounded-full bg-on-surface" />
                <span className="h-1 w-1 rounded-full bg-on-surface" />
                <span className="h-1 w-1 rounded-full bg-on-surface" />
              </div>
            )
          }
          if (block.type === 'embed') {
            return (
              <div
                key={block.id}
                className={`group relative -ml-12 pl-12 ${dropHighlight(blockIndex)}`}
                {...dragProps(block)}
              >
                <DragHandle blockId={block.id} />
                <iframe
                  src={embedSrc(block.url)}
                  title="Video embed"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="aspect-video w-full border border-outline"
                />
              </div>
            )
          }
          return (
            <div
              key={block.id}
              className={`group relative -ml-12 pl-12 ${dropHighlight(blockIndex)}`}
              {...dragProps(block)}
            >
              <DragHandle blockId={block.id} />
              <a
                href={block.url.startsWith('http') ? block.url : `https://${block.url}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-36 overflow-hidden border border-outline bg-surface-lowest transition-shadow hover:shadow-float"
              >
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-6">
                  <p className="truncate text-lg font-semibold text-on-surface">
                    {domainOf(block.url)}
                  </p>
                  <p className="truncate text-base text-on-surface-variant">{block.url}</p>
                  <p className="mt-1 truncate text-sm text-muted">{domainOf(block.url)}</p>
                </div>
                <div className="flex h-full w-36 shrink-0 items-center justify-center bg-surface-low text-muted">
                  <Icon name="link" className="text-[28px]" />
                </div>
              </a>
            </div>
          )
        })}
      </div>

      {toolbar && toolbarLink && (
        <div
          ref={toolbarRef}
          className="fixed z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-inverse-surface px-2 py-1.5 shadow-float"
          style={{ top: toolbar.top, left: toolbar.left }}
        >
          <input
            autoFocus
            type="text"
            value={toolbarUrl}
            onChange={(event) => setToolbarUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyToolbarLink()
              if (event.key === 'Escape') {
                setToolbarLink(false)
                setToolbarUrl('')
                savedRangeRef.current = null
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
              setToolbarLink(false)
              setToolbarUrl('')
              savedRangeRef.current = null
            }}
            className="flex h-8 w-8 items-center justify-center rounded text-white transition-opacity hover:opacity-70"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
      )}
      {toolbar && !toolbarLink && (
        <div
          className="fixed z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-lg bg-inverse-surface px-1.5 py-1 shadow-float"
          style={{ top: toolbar.top, left: toolbar.left }}
        >
          <button type="button" onMouseDown={(e) => { e.preventDefault(); format('bold') }} className={toolbarButton}>
            <Icon name="format_bold" className="text-[20px]" />
          </button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); format('italic') }} className={toolbarButton}>
            <Icon name="format_italic" className="text-[20px]" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              const selection = window.getSelection()
              if (selection && selection.rangeCount > 0) {
                savedRangeRef.current = selection.getRangeAt(0).cloneRange()
              }
              setToolbarLink(true)
            }}
            className={toolbarButton}
          >
            <Icon name="link" className="text-[20px]" />
          </button>
          <span className="mx-1 h-5 w-px bg-white/30" />
          <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleBlockTag('h3') }} className={toolbarButton}>
            <span className="text-lg font-bold">T</span>
          </button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleBlockTag('h4') }} className={toolbarButton}>
            <span className="text-sm font-bold">T</span>
          </button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleBlockTag('blockquote') }} className={toolbarButton}>
            <Icon name="format_quote" className="text-[20px]" />
          </button>
        </div>
      )}
    </div>
  )
}
