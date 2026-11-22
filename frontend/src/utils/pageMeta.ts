/**
 * Per-page search and share metadata.
 *
 * The HTML shells (index.html, landing.html) carry site-wide defaults, which is
 * all a crawler that does not run JavaScript will see. Once the app runs, each
 * public page replaces those defaults with its own title, description,
 * canonical URL and share image, so search engines that render JavaScript
 * index every page under its own name instead of one shared title.
 *
 * Tags are updated in place rather than appended, so the shell's defaults are
 * never duplicated by the page's values.
 */

export const SITE_URL = 'https://davaodeficommunity.com'
export const SITE_NAME = 'Davao DeFi Community'
export const HOME_TITLE = 'Davao DeFi Community — Web3 Community in Davao, Philippines'
export const DEFAULT_DESCRIPTION =
  'Davao DeFi Community is a Web3 and DeFi community in Davao City, Mindanao. Join meetups, workshops, and build sessions with local builders and creators.'
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`

const DESCRIPTION_MAX_LENGTH = 160

export type PageMeta = {
  /** Page name, without the site name. Omit for the home page. */
  title?: string
  description?: string | null
  /** Site path for the canonical URL. Query strings are never part of it. */
  path: string
  /** Absolute, or relative to the site root. Falls back to the site share image. */
  image?: string | null
  type?: 'website' | 'article'
  /** Keep the page out of search results (not-found states, private pages). */
  noindex?: boolean
}

export function absoluteUrl(url: string): string {
  return new URL(url, SITE_URL).toString()
}

/**
 * Plain text from rich-text HTML. Tags become spaces first so paragraphs do not
 * run together, then entities such as &amp; are decoded. Parsed into a detached
 * document and read back as text, so nothing in it is ever executed.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return ''
  const spaced = html.replace(/<[^>]*>/g, ' ')
  return new DOMParser().parseFromString(spaced, 'text/html').body.textContent ?? ''
}

/** Collapse whitespace and cut at a word boundary so snippets do not end mid-word. */
export function toMetaDescription(text: string | null | undefined): string | null {
  const plain = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!plain) return null
  if (plain.length <= DESCRIPTION_MAX_LENGTH) return plain
  const cut = plain.slice(0, DESCRIPTION_MAX_LENGTH - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–—-]+$/, '')}…`
}

function setMeta(doc: Document, attribute: 'name' | 'property', key: string, content: string | null) {
  let element = doc.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (content === null) {
    element?.remove()
    return
  }
  if (!element) {
    element = doc.createElement('meta')
    element.setAttribute(attribute, key)
    doc.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function setCanonical(doc: Document, href: string) {
  let element = doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!element) {
    element = doc.createElement('link')
    element.setAttribute('rel', 'canonical')
    doc.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

export function applyPageMeta(meta: PageMeta, doc: Document = document) {
  const title = meta.title ? `${meta.title} — ${SITE_NAME}` : HOME_TITLE
  const description = toMetaDescription(meta.description) ?? DEFAULT_DESCRIPTION
  const url = absoluteUrl(meta.path)
  const image = meta.image ? absoluteUrl(meta.image) : DEFAULT_IMAGE

  doc.title = title
  setMeta(doc, 'name', 'description', description)
  setMeta(doc, 'name', 'robots', meta.noindex ? 'noindex' : null)
  setCanonical(doc, url)

  setMeta(doc, 'property', 'og:title', title)
  setMeta(doc, 'property', 'og:description', description)
  setMeta(doc, 'property', 'og:url', url)
  setMeta(doc, 'property', 'og:type', meta.type ?? 'website')
  setMeta(doc, 'property', 'og:image', image)
  // The shell's dimensions and alt text describe the default image only.
  const isDefaultImage = image === DEFAULT_IMAGE
  setMeta(doc, 'property', 'og:image:width', isDefaultImage ? '1200' : null)
  setMeta(doc, 'property', 'og:image:height', isDefaultImage ? '630' : null)
  setMeta(doc, 'property', 'og:image:alt', isDefaultImage ? 'Davao DeFi Community members at community events' : null)
}
