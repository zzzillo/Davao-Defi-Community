import { beforeEach, describe, expect, it } from 'vitest'

import {
  applyPageMeta,
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE,
  HOME_TITLE,
  htmlToPlainText,
  toMetaDescription,
} from './pageMeta'

function meta(selector: string) {
  return document.head.querySelectorAll(selector)
}

function content(selector: string) {
  return document.head.querySelector(selector)?.getAttribute('content') ?? null
}

describe('applyPageMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <title>Davao DeFi Community</title>
      <meta name="description" content="Shell default" />
      <meta property="og:title" content="Shell default" />
      <meta property="og:image" content="${DEFAULT_IMAGE}" />
      <meta property="og:image:width" content="1200" />
    `
  })

  it('replaces the shell defaults in place instead of adding duplicates', () => {
    applyPageMeta({ title: 'Blog', description: 'Guides and news.', path: '/blogs' })

    expect(document.title).toBe('Blog — Davao DeFi Community')
    expect(meta('meta[name="description"]')).toHaveLength(1)
    expect(content('meta[name="description"]')).toBe('Guides and news.')
    expect(meta('meta[property="og:title"]')).toHaveLength(1)
    expect(content('meta[property="og:title"]')).toBe('Blog — Davao DeFi Community')
    expect(content('meta[property="og:url"]')).toBe('https://davaodeficommunity.com/blogs')
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe('https://davaodeficommunity.com/blogs')
  })

  it('uses the home title and default description when a page gives none', () => {
    applyPageMeta({ path: '/', description: '   ' })

    expect(document.title).toBe(HOME_TITLE)
    expect(content('meta[name="description"]')).toBe(DEFAULT_DESCRIPTION)
    expect(content('meta[property="og:image"]')).toBe(DEFAULT_IMAGE)
    expect(content('meta[property="og:image:width"]')).toBe('1200')
  })

  it('makes page images absolute and drops the default image dimensions', () => {
    applyPageMeta({ title: 'Article', path: '/blog/a', image: '/r2/blogs/cover.webp', type: 'article' })

    expect(content('meta[property="og:image"]')).toBe('https://davaodeficommunity.com/r2/blogs/cover.webp')
    expect(content('meta[property="og:type"]')).toBe('article')
    expect(meta('meta[property="og:image:width"]')).toHaveLength(0)
  })

  it('adds noindex only while a page asks for it', () => {
    applyPageMeta({ title: 'Article not found', path: '/blog/missing', noindex: true })
    expect(content('meta[name="robots"]')).toBe('noindex')

    applyPageMeta({ title: 'Blog', path: '/blogs' })
    expect(meta('meta[name="robots"]')).toHaveLength(0)
  })
})

describe('htmlToPlainText', () => {
  it('keeps paragraphs apart and decodes entities', () => {
    expect(toMetaDescription(htmlToPlainText('<p>Talks &amp; panels.</p><p>Build&nbsp;sessions</p>')))
      .toBe('Talks & panels. Build sessions')
    expect(htmlToPlainText(null)).toBe('')
  })
})

describe('toMetaDescription', () => {
  it('collapses whitespace and returns null for empty text', () => {
    expect(toMetaDescription('  a\n\n b  ')).toBe('a b')
    expect(toMetaDescription(null)).toBeNull()
    expect(toMetaDescription('   ')).toBeNull()
  })

  it('cuts long text at a word boundary', () => {
    const text = `${'word '.repeat(60)}end`
    const result = toMetaDescription(text)!
    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.endsWith('word…')).toBe(true)
  })
})
