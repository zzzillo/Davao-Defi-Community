/**
 * The "+" menu offered inside the rich-text description editors.
 *
 * Data, not behaviour: each entry says what it wants done, and the page's own
 * runPlusItem does it. Building the list therefore touches no refs, which is
 * what lets it live out here as a constant - a list rebuilt on every render
 * whose entries close over refs is exactly what React's compiler refuses,
 * because it cannot prove those closures only run later.
 *
 * Shared by the event and post editors so the two menus cannot drift apart.
 */
export type PlusItem = { icon: string; label: string } & (
  | { kind: 'format'; command: string; value?: string }
  | { kind: 'image' }
)

export const PLUS_ITEMS: PlusItem[] = [
  { icon: 'format_h1', label: 'Heading', kind: 'format', command: 'formatBlock', value: 'h3' },
  { icon: 'image', label: 'Image', kind: 'image' },
  { icon: 'format_h2', label: 'Subheading', kind: 'format', command: 'formatBlock', value: 'h4' },
  {
    icon: 'format_quote',
    label: 'Blockquote',
    kind: 'format',
    command: 'formatBlock',
    value: 'blockquote',
  },
  { icon: 'more_horiz', label: 'Divider', kind: 'format', command: 'insertHorizontalRule' },
  { icon: 'format_list_bulleted', label: 'List', kind: 'format', command: 'insertUnorderedList' },
  {
    icon: 'format_list_numbered',
    label: 'Numbered List',
    kind: 'format',
    command: 'insertOrderedList',
  },
]
