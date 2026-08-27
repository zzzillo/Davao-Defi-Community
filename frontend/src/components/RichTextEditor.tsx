import { useEffect, useRef, useState } from 'react'

import Icon from './Icon'
import { PLUS_ITEMS } from '../utils/editor'
import type { PlusItem } from '../utils/editor'

/**
 * The rich-text editor, shared by every module that stores authored HTML.
 *
 * Lifted out of NewEvent, where it was roughly four hundred lines of the same
 * component that also handled dates, timezones and location search. Blogs
 * needs an identical editor, and copying this would have meant two homes for
 * some of the most delicate code in the project - caret restoration, selection
 * ranges, and the list-outdent behaviour below, none of which a type checker
 * or a linter can tell you is broken.
 *
 * UNCONTROLLED ON PURPOSE, and this is the single most important thing about
 * it. innerHTML is written exactly once, on mount. A controlled contentEditable
 * - one that re-writes innerHTML whenever `value` changes - moves the caret
 * back to the start of the document on every keystroke, because replacing the
 * DOM destroys the selection sitting inside it.
 *
 * So `initialHtml` is a seed rather than a binding, and `onChange` reports
 * outwards. A parent may store what it receives; it must not feed it back.
 * Remount the component with a different `key` to genuinely reset it.
 *
 * execCommand is deprecated and has no replacement with comparable support.
 * Every browser still implements it, and the alternative is a document model
 * plus a renderer - see the comparison in the blogs design notes. The
 * deprecation is contained here: the editor produces HTML, the backend
 * sanitises HTML, and swapping this component changes nothing downstream.
 */

export type RichTextEditorProps = {
  /** Read once, on mount. Later changes are ignored - see above. */
  initialHtml: string
  /** Fires on every edit with the editor's current HTML. */
  onChange: (html: string) => void
  placeholder?: string
  /** Tailwind height class for the editable surface. */
  minHeightClassName?: string
  /**
   * Whether the editor scrolls inside its own box.
   *
   * True for the event modal, which is a fixed-height panel. False for the
   * blog form, where the article grows down the page and the window scrolls -
   * a nested scroll region inside a long form is a scroll trap.
   */
  scrollable?: boolean
}

const TOOLBAR_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded text-white transition-opacity hover:opacity-70'

export default function RichTextEditor({
  initialHtml,
  onChange,
  placeholder = 'Start writing...',
  minHeightClassName = 'min-h-64',
  scrollable = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const savedRangeRef = useRef<Range | null>(null)

  const [plusTop, setPlusTop] = useState<number | null>(null)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [plusMenuPos, setPlusMenuPos] = useState<
    { left: number; top: number; up: boolean } | null
  >(null)
  const plusBtnRef = useRef<HTMLButtonElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const plusRangeRef = useRef<Range | null>(null)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageRangeRef = useRef<Range | null>(null)

  /** Report the DOM's current state upward. Called after every mutation. */
  function publish() {
    onChange(editorRef.current?.innerHTML ?? '')
  }

  // Closes the plus menu when a click lands outside it.
  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      const target = event.target as Node
      if (!target.isConnected) return

      if (
        !plusMenuRef.current?.contains(target) &&
        !plusBtnRef.current?.contains(target)
      ) {
        setPlusMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  // Seeds the editor on mount. No dependencies: re-running this would rewrite
  // innerHTML and throw the caret back to the top mid-sentence.
  useEffect(() => {
    document.execCommand('defaultParagraphSeparator', false, 'p')

    const editor = editorRef.current
    if (!editor) return

    if (editor.innerHTML.trim() === '') {
      editor.innerHTML = '<p><br></p>'
    }

    editor.dataset.empty = (editor.textContent ?? '') === '' ? 'true' : 'false'
  }, [])

  // Keeps the floating toolbar and the "+" button following the caret.
  //
  // Separate from the seeding effect because it reads linkMode and
  // plusMenuOpen, so it must resubscribe when either changes - and folding it
  // into the one above would mean wiping the editor every time the menu opens.
  useEffect(() => {
    function onSelectionChange() {
      if (linkMode) return

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

      if (plusMenuOpen) return

      const editor = editorRef.current

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
  }, [linkMode, plusMenuOpen])

  function format(command: string, value?: string) {
    document.execCommand(command, false, value)
    publish()
  }

  function toggleBlock(tag: 'h3' | 'h4' | 'blockquote') {
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

      if (element === editorRef.current) break
      node = node.parentNode
    }

    format('formatBlock', current === tag.toUpperCase() ? 'p' : tag)
  }

  function applyLink() {
    const url = linkUrl.trim()
    const saved = savedRangeRef.current

    if (url && saved) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(saved)
      format('createLink', url.startsWith('http') ? url : `https://${url}`)
    }

    setLinkMode(false)
    setLinkUrl('')
    savedRangeRef.current = null
    setToolbar(null)
  }

  function runPlusItem(item: PlusItem) {
    const saved = plusRangeRef.current
    editorRef.current?.focus()

    if (saved) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(saved)
      // Collapse so block actions (lists, headings) apply to this line only.
      selection?.collapseToStart()
    }

    if (item.kind === 'image') {
      // Read after the restore above, so the picture lands where the caret was
      // when the menu opened rather than wherever focus drifted.
      const selection = window.getSelection()

      if (selection && selection.rangeCount > 0) {
        imageRangeRef.current = selection.getRangeAt(0).cloneRange()
      }

      imageInputRef.current?.click()
    } else {
      format(item.command, item.value)
    }

    setPlusMenuOpen(false)
    plusRangeRef.current = null
  }

  /** Scrolls just enough that the caret is not pinned to the bottom edge. */
  function ensureCaretBreathingRoom() {
    const scrollEl = scrollRef.current
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

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') {
      const selection = window.getSelection()
      const editor = editorRef.current
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
        const list = listItem.closest('ul, ol')
        if (!list) return

        const parentItem = list.parentElement?.closest('li') as HTMLElement | null

        if (parentItem) {
          // Empty sublist item: outdent into the outer list.
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
          publish()
          return
        }

        // Normalise legacy nesting like <p><ul>...</ul></p>.
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
        publish()
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
        // A new line after a styled block starts plain - do not inherit it.
        event.preventDefault()
        document.execCommand('insertParagraph')
        document.execCommand('formatBlock', false, 'p')
        publish()
      }

      return
    }

    if (event.key === 'Backspace') {
      const selection = window.getSelection()
      const editor = editorRef.current
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

        // No initialiser: every branch below assigns one, and TypeScript
        // checks that before the read.
        let caretTarget: HTMLElement | null

        if (!parentItem && previousItem) {
          // Top level: turn the empty item into a sublist of the item above.
          const sublist = document.createElement('ul')
          const subItem = document.createElement('li')
          subItem.innerHTML = '<br>'
          sublist.appendChild(subItem)
          previousItem.appendChild(sublist)
          listItem.remove()
          caretTarget = subItem
        } else {
          // Nested, or the first item: remove and step back out.
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

        publish()
        return
      }

      let node: Node | null = selection.anchorNode

      while (node && node !== editor) {
        const tagName = (node as HTMLElement).tagName

        if (tagName === 'BLOCKQUOTE' || tagName === 'H3' || tagName === 'H4') {
          if (((node as HTMLElement).textContent ?? '') === '') {
            event.preventDefault()
            document.execCommand('formatBlock', false, 'p')
            publish()
          }
          return
        }

        node = node.parentNode
      }

      return
    }

    if (event.key === ' ') {
      const selection = window.getSelection()
      const editor = editorRef.current
      if (!selection || !editor) return

      let node: Node | null = selection.anchorNode
      while (node && node.parentNode !== editor) node = node.parentNode

      const block = (node as HTMLElement | null) ?? editor
      const trigger = block.textContent ?? ''

      if (trigger === '-' || trigger === '1.') {
        event.preventDefault()
        // Built directly: execCommand nests the list inside the paragraph.
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
        publish()
      }
    }
  }

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return

          // A blob URL, which lives only in this browser tab. Until R2 exists
          // there is nowhere to put the file, so the picture is visible while
          // writing and does not survive a reload. See storageService.
          const url = URL.createObjectURL(file)
          editorRef.current?.focus()

          const saved = imageRangeRef.current
          const selection = window.getSelection()

          if (saved && selection) {
            selection.removeAllRanges()
            selection.addRange(saved)
          }

          document.execCommand('insertImage', false, url)

          const editor = editorRef.current
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

          imageRangeRef.current = null
          publish()
        }}
      />

      <div
        ref={scrollRef}
        className={`relative ${scrollable ? 'flex-1 overflow-y-auto' : ''}`}
      >
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
              // Flip upwards near the bottom of the window, so the menu is not
              // half off-screen.
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
              {PLUS_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    runPlusItem(item)
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
            editorRef.current = node

            // Initialise once per mount; rewriting on re-render wipes live
            // edits and sends the caret back to the top.
            if (node && node.dataset.mounted !== 'true') {
              node.dataset.mounted = 'true'
              node.innerHTML = initialHtml
            }
          }}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onKeyDown={handleKeyDown}
          onInput={(event) => {
            const el = event.target as HTMLElement
            const empty = (el.textContent ?? '') === ''
            const inputType = (event.nativeEvent as InputEvent).inputType ?? ''

            // Select-all then delete leaves husks like <ul><li><br></li></ul>.
            // Only clean on deletions, or this would eat a new empty list.
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
            publish()
          }}
          className={`editor-block desc-editor relative ${minHeightClassName} pb-4 pl-12 pr-5 pt-4 text-base leading-relaxed text-on-surface focus:outline-none`}
        />
      </div>

      {toolbar && linkMode && (
        <div
          className="fixed z-50 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-inverse-surface px-2 py-1.5 shadow-float"
          style={{ top: toolbar.top, left: toolbar.left }}
        >
          <input
            autoFocus
            type="text"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyLink()
              if (event.key === 'Escape') {
                setLinkMode(false)
                setLinkUrl('')
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
              setLinkMode(false)
              setLinkUrl('')
            }}
            className={TOOLBAR_BUTTON}
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
      )}

      {toolbar && !linkMode && (
        <div
          className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-lg bg-inverse-surface px-1.5 py-1 shadow-float"
          style={{ top: toolbar.top, left: toolbar.left }}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              toggleBlock('h3')
            }}
            className={TOOLBAR_BUTTON}
          >
            <span className="text-sm font-bold">H1</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              toggleBlock('h4')
            }}
            className={TOOLBAR_BUTTON}
          >
            <span className="text-sm font-bold">H2</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              format('bold')
            }}
            className={TOOLBAR_BUTTON}
          >
            <Icon name="format_bold" className="text-[20px]" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              format('italic')
            }}
            className={TOOLBAR_BUTTON}
          >
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

              setLinkMode(true)
            }}
            className={TOOLBAR_BUTTON}
          >
            <Icon name="link" className="text-[20px]" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              toggleBlock('blockquote')
            }}
            className={TOOLBAR_BUTTON}
          >
            <Icon name="format_quote" className="text-[20px]" />
          </button>
        </div>
      )}
    </>
  )
}
