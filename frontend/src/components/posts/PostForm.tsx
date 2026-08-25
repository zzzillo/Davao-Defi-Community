import { useState } from 'react'
import Icon from '../Icon'
import EventSelector from './EventSelector'
import ImageUploader from './ImageUploader'
import type { PendingImage } from './ImageUploader'
import type { ApiError } from '../../services/api'
import { STORAGE_CONFIGURED } from '../../services/storageService'
import type { PostCreatePayload, PostResponse } from '../../types/post'

type PostFormProps = {
  /** The post being edited. Null or undefined when creating one. */
  post?: PostResponse | null
  /** True while the parent's save is in flight. */
  saving: boolean
  /** Whatever the last save failed with, or null. */
  error: ApiError | null
  onSubmit: (payload: PostCreatePayload) => void
  onCancel: () => void
}

const TITLE_MAX_LENGTH = 200
const LOCATION_MAX_LENGTH = 300
const DESCRIPTION_MAX_LENGTH = 5000

/** Today as "YYYY-MM-DD" in the *reader's* timezone, which is what they mean. */
function todayLocal(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${now.getFullYear()}-${month}-${day}`
}

function toPending(post: PostResponse): PendingImage[] {
  return post.images.map((image) => ({
    id: image.id,
    image_key: image.image_key,
    previewUrl: image.image_url,
    // Already stored, so there is no File and nothing to upload.
    file: null,
  }))
}

/**
 * The create and edit form for a post.
 *
 * Holds form state and nothing else. Saving, loading and error handling belong
 * to the page, which owns the hooks - so this component can be rendered by the
 * "new" route and the "edit" route without knowing which it is.
 *
 * Field order follows the mockup: draft toggle, photos, date, event, location,
 * caption, submit. Photos come first because they are the post; everything
 * below them is metadata about them.
 */
export default function PostForm({
  post,
  saving,
  error,
  onSubmit,
  onCancel,
}: PostFormProps) {
  const [title, setTitle] = useState('')
  const [postDate, setPostDate] = useState(todayLocal)
  const [eventId, setEventId] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [isDraft, setIsDraft] = useState(true)
  const [images, setImages] = useState<PendingImage[]>([])

  // Fill the form once the post being edited arrives.
  //
  // Done during render rather than in an effect. React documents this as the
  // way to adjust state when the thing being edited changes: it re-runs the
  // component before painting, so nothing flashes, and there is no second
  // commit the way an effect would cause.
  //
  // hydratedId also guards against a refetch overwriting half-typed edits.
  const [hydratedId, setHydratedId] = useState<string | null>(null)

  if (post && post.id !== hydratedId) {
    setHydratedId(post.id)
    setTitle(post.title ?? '')
    setPostDate(post.post_date)
    setEventId(post.event?.id ?? null)
    setLocation(post.location ?? '')
    setDescription(post.description ?? '')
    setIsDraft(!post.published)
    setImages(toPending(post))
  }

  // A photograph with no key has never been stored, so there is nothing to
  // record. Until storage exists that is every newly picked file.
  const unsaveable = images.filter((image) => !image.image_key).length
  const storableImages = images.filter((image) => image.image_key)

  function handleSubmit() {
    onSubmit({
      // An empty box means "no title", not a title of "". The API takes null.
      title: title.trim() || null,
      description: description.trim() || null,
      location: location.trim() || null,
      post_date: postDate,
      event_id: eventId,
      published: !isDraft,
      images: storableImages.map((image) => ({ image_key: image.image_key as string })),
    })
  }

  // Publishing needs at least one storable photo; the API refuses otherwise,
  // and finding that out after pressing save is a worse way to learn it.
  const blockedFromPublishing = !isDraft && storableImages.length === 0

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
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

      <ImageUploader images={images} onChange={setImages} disabled={saving} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Title</span>
        <input
          type="text"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Optional - defaults to the event name"
          className="rounded-lg border border-outline bg-surface-lowest px-4 py-3 text-sm text-on-surface placeholder:text-muted focus:border-outline-strong focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Post date</span>
        {/*
          A native date input, whose value is already "YYYY-MM-DD" - exactly
          what the API stores. That is the quiet payoff of post_date being a
          DATE: no picker component, no timezone conversion, no chance of the
          day shifting between the form and the database.
        */}
        <input
          type="date"
          value={postDate}
          onChange={(event) => setPostDate(event.target.value)}
          className="rounded-lg border border-outline bg-surface-lowest px-4 py-3 text-sm text-on-surface focus:border-outline-strong focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Event</span>
        <EventSelector value={eventId} onChange={setEventId} disabled={saving} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Location</span>
        <input
          type="text"
          value={location}
          maxLength={LOCATION_MAX_LENGTH}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Where this happened"
          className="rounded-lg border border-outline bg-surface-lowest px-4 py-3 text-sm text-on-surface placeholder:text-muted focus:border-outline-strong focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Caption</span>
        {/*
          A plain textarea, not the rich editor the event form uses. A recap's
          caption is a paragraph under a gallery - headings, lists and inline
          images would be competing with the photographs. Line breaks survive,
          which is all this needs.
        */}
        <textarea
          value={description}
          rows={5}
          maxLength={DESCRIPTION_MAX_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Say something about the day"
          className="resize-y rounded-lg border border-outline bg-surface-lowest px-4 py-3 text-sm text-on-surface placeholder:text-muted focus:border-outline-strong focus:outline-none"
        />
        <span className="self-end text-xs text-muted">
          {description.length} / {DESCRIPTION_MAX_LENGTH}
        </span>
      </label>

      {unsaveable > 0 && (
        <p className="rounded-lg bg-warning-bg px-4 py-3 text-sm font-medium text-warning">
          {unsaveable} photo{unsaveable === 1 ? '' : 's'} cannot be saved
          {STORAGE_CONFIGURED ? ' because uploading failed.' : ' until image storage is set up.'}{' '}
          Everything else on this form will save normally.
        </p>
      )}

      {blockedFromPublishing && (
        <p className="rounded-lg bg-warning-bg px-4 py-3 text-sm font-medium text-warning">
          A published post needs at least one saved photo. Turn on Save as Draft,
          or add photos once storage is set up.
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-error/15 px-4 py-3 text-sm font-medium text-error">
          <p>{error.message}</p>
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
        disabled={saving || blockedFromPublishing}
        onClick={handleSubmit}
        className="w-full rounded-lg bg-btn py-3 text-base font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? 'Saving...' : isDraft ? 'Save Draft' : post ? 'Save Changes' : 'Create Post'}
      </button>
    </div>
  )
}
