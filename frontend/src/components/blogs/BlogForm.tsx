import { useState } from 'react'

import Icon from '../Icon'
import RichTextEditor from '../RichTextEditor'
import type { ApiError } from '../../services/api'
import { STORAGE_CONFIGURED } from '../../services/storageService'
import type { BlogCreatePayload, BlogResponse } from '../../types/blog'
import { htmlToText, readingTime, slugify, suggestExcerpt } from '../../utils/blog'

type BlogFormProps = {
  /** The article being edited. Null or undefined when creating one. */
  blog?: BlogResponse | null
  /** True while the parent's save is in flight. */
  saving: boolean
  /** Whatever the last save failed with, or null. */
  error: ApiError | null
  onSubmit: (payload: BlogCreatePayload) => void
  onCancel: () => void
}

const TITLE_MAX_LENGTH = 200
const EXCERPT_MAX_LENGTH = 300

/**
 * The create and edit form for an article.
 *
 * Holds form state and nothing else. Saving, loading and error handling belong
 * to the page, which owns the hooks - so this component can be rendered by the
 * "new" route and the "edit" route without knowing which it is. Same split as
 * PostForm.
 *
 * The body uses the shared RichTextEditor rather than a modal, unlike the
 * event form. An event description is a paragraph somebody writes once; an
 * article is the thing itself, and putting it behind a "click to open" dialog
 * would mean the writer never sees their article and its metadata together.
 */
export default function BlogForm({
  blog,
  saving,
  error,
  onSubmit,
  onCancel,
}: BlogFormProps) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [isDraft, setIsDraft] = useState(true)

  /**
   * Whether the author has taken the slug into their own hands.
   *
   * Until they do, the slug follows the title. After they do, it stops - a
   * deliberately chosen address must not be silently rewritten the next time
   * somebody fixes a typo in the headline.
   */
  const [slugEdited, setSlugEdited] = useState(false)

  // Fill the form once the article being edited arrives.
  //
  // Done during render rather than in an effect. React documents this as the
  // way to adjust state when the thing being edited changes: it re-runs the
  // component before painting, so nothing flashes, and there is no second
  // commit the way an effect would cause.
  //
  // hydratedId also guards against a refetch overwriting half-typed edits.
  const [hydratedId, setHydratedId] = useState<string | null>(null)

  if (blog && blog.id !== hydratedId) {
    setHydratedId(blog.id)
    setTitle(blog.title)
    setSlug(blog.slug)
    setExcerpt(blog.excerpt ?? '')
    setContent(blog.content ?? '')
    setIsDraft(!blog.published)
    // An existing article's slug is already a decision somebody made, whether
    // by choosing it or by accepting the generated one. Either way, editing
    // the title must not move it.
    setSlugEdited(true)
  }

  // Published articles have a frozen address. Checked against the STORED flag,
  // not the toggle: an article being published by this very save has not been
  // public yet, so its URL is still nobody's and may still change.
  const slugLocked = blog?.published === true

  const previewSlug = slugEdited ? slug : slugify(title)

  // slugify returns "" for a title with no ASCII in it at all. The server
  // falls back to blog-<token>, so say so rather than showing an empty URL.
  const slugIsGenerated = previewSlug === ''

  const bodyText = htmlToText(content)
  const canPublish = bodyText.length > 0 && excerpt.trim().length > 0

  function handleTitleChange(value: string) {
    setTitle(value)

    if (!slugEdited && !slugLocked) {
      setSlug(slugify(value))
    }
  }

  function handleSubmit() {
    onSubmit({
      title: title.trim(),
      // Omitted entirely when locked, so a PATCH never carries a slug the
      // server would have to refuse. Sending the unchanged value would be
      // harmless today and a 409 the day the comparison drifts.
      ...(slugLocked ? {} : { slug: previewSlug || null }),
      excerpt: excerpt.trim() || null,
      // An empty editor still leaves markup behind, so emptiness is judged on
      // the text rather than the HTML.
      content: bodyText ? content : null,
      published: !isDraft,
    })
  }

  const frozenSlug = error?.reason === 'slug_frozen'
  const takenSlug = error?.reason === 'slug_taken'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" className="text-[20px]" />
          Back to Blogs
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

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Title</span>
        <input
          type="text"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="Understanding Web3"
          className="rounded-lg border border-outline bg-surface-lowest px-4 py-3 text-lg font-semibold text-on-surface placeholder:font-normal placeholder:text-muted focus:border-outline-strong focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-on-surface">Address</span>

          {/*
            Shown only while the address can still change. A disabled control
            with no explanation reads as a bug; the note below says why.
          */}
          {!slugLocked && slugEdited && (
            <button
              type="button"
              onClick={() => {
                setSlugEdited(false)
                setSlug(slugify(title))
              }}
              className="text-xs font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Match the title
            </button>
          )}
        </div>

        <div
          className={`flex items-center rounded-lg border border-outline bg-surface-lowest px-4 ${
            slugLocked ? 'opacity-60' : ''
          }`}
        >
          <span className="shrink-0 py-3 text-sm text-muted">/blog/</span>
          <input
            type="text"
            value={slug}
            disabled={slugLocked}
            maxLength={220}
            onChange={(event) => {
              setSlugEdited(true)
              setSlug(event.target.value)
            }}
            placeholder={slugify(title) || 'understanding-web3'}
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-on-surface placeholder:text-muted focus:outline-none disabled:cursor-not-allowed"
          />
        </div>

        {slugLocked ? (
          <p className="text-xs text-muted">
            The address is fixed once an article is published - it may already be
            in a search result, a bookmark, or a shared link. Unpublish it first
            if the URL is genuinely wrong.
          </p>
        ) : slugIsGenerated && title.trim() !== '' ? (
          <p className="text-xs text-muted">
            This title has no letters the URL can use, so the server will pick an
            address for it. Type one above to choose your own.
          </p>
        ) : (
          <p className="text-xs text-muted">
            {slugEdited
              ? 'Chosen by you. It will not change when the title does.'
              : 'Follows the title until you edit it.'}{' '}
            If this address is taken, the server appends a number.
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-on-surface">Summary</span>

          {bodyText.length > 0 && (
            <button
              type="button"
              onClick={() => setExcerpt(suggestExcerpt(content, EXCERPT_MAX_LENGTH))}
              className="text-xs font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Use the opening
            </button>
          )}
        </div>

        <textarea
          value={excerpt}
          rows={3}
          maxLength={EXCERPT_MAX_LENGTH}
          onChange={(event) => setExcerpt(event.target.value)}
          placeholder="One or two sentences. This is what appears on the card and in search results."
          className="resize-y rounded-lg border border-outline bg-surface-lowest px-4 py-3 text-sm text-on-surface placeholder:text-muted focus:border-outline-strong focus:outline-none"
        />
        <span className="self-end text-xs text-muted">
          {excerpt.length} / {EXCERPT_MAX_LENGTH}
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-on-surface">Article</span>
          <span className="text-xs text-muted">{readingTime(content)}</span>
        </div>

        <div className="rounded-lg border border-outline bg-surface-lowest">
          {/*
            Keyed on the article's id so navigating from one article to another
            remounts the editor and reseeds it. RichTextEditor reads
            initialHtml once, on mount - that is what stops it stamping on the
            caret - so a key is the only way to give it new content.
          */}
          <RichTextEditor
            key={blog?.id ?? 'new'}
            initialHtml={blog?.content ?? ''}
            onChange={setContent}
            placeholder="Write the article..."
            minHeightClassName="min-h-96"
          />
        </div>
      </div>

      {!STORAGE_CONFIGURED && (
        <p className="rounded-lg bg-warning-bg px-4 py-3 text-sm font-medium text-warning">
          Pictures dropped into the article are visible while you write but are
          not stored yet, so they will not survive a reload. The text saves
          normally. Cover images arrive with image storage.
        </p>
      )}

      {!isDraft && !canPublish && (
        <p className="rounded-lg bg-warning-bg px-4 py-3 text-sm font-medium text-warning">
          A published article needs {bodyText.length === 0 ? 'a body' : ''}
          {bodyText.length === 0 && excerpt.trim() === '' ? ' and ' : ''}
          {excerpt.trim() === '' ? 'a summary' : ''}. Turn on Save as Draft, or
          fill in what is missing.
        </p>
      )}

      {/*
        The consequence of publishing that nothing else on this form makes
        visible. Shown before the button rather than after the 409.
      */}
      {!isDraft && canPublish && !slugLocked && (
        <p className="rounded-lg bg-surface-low px-4 py-3 text-sm text-on-surface-variant">
          Publishing fixes this article's address at{' '}
          <span className="font-semibold text-on-surface">
            /blog/{previewSlug || '...'}
          </span>
          . It can still be changed later by unpublishing first.
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
          {/*
            A frozen or taken slug is not a malformed field, and saying "some
            of the details are invalid" would send the author hunting for a
            typo that is not there. Each gets the sentence that says what to do.
          */}
          {frozenSlug ? (
            <p>
              This article is published, so its address cannot change. Turn on
              Save as Draft and save, change the address, then publish again.
            </p>
          ) : takenSlug ? (
            <p>
              Another article already lives at /blog/{previewSlug}. Choose a
              different address, or clear the field and let the server pick one.
            </p>
          ) : (
            <p>{error.message}</p>
          )}

          {/* A 422 names the field it rejected, so say which one. */}
          {error.fields.map((field) => (
            <p key={field.field} className="mt-1 font-normal">
              {field.field}: {field.message}
            </p>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={saving || title.trim() === '' || (!isDraft && !canPublish)}
        onClick={handleSubmit}
        className="w-full rounded-lg bg-btn py-3 text-base font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? 'Saving...'
          : isDraft
            ? 'Save Draft'
            : blog
              ? 'Save Changes'
              : 'Publish Article'}
      </button>
    </div>
  )
}
