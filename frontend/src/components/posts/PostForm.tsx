import { useLayoutEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import CalendarDatePicker from '../CalendarDatePicker'
import EventSelector from './EventSelector'
import ImageUploader from './ImageUploader'
import type { PendingImage } from './ImageUploader'
import type { ApiError } from '../../services/api'
import { STORAGE_CONFIGURED } from '../../services/storageService'
import { useToast, useToastError } from '../../hooks/useToast'
import { useLocationSearch } from '../../hooks/useLocationSearch'
import type { PostCreatePayload, PostResponse } from '../../types/post'

type PostFormProps = {
  /** The post being edited. Null or undefined when creating one. */
  post?: PostResponse | null
  /**
   * Preselect an event when creating. Comes from /admin/posts/new?event=<id>,
   * which is how the events table offers "write the recap for this one".
   * Ignored when editing, where the post's own link wins.
   */
  initialEventId?: string | null
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
    uploading: false,
    uploadError: null,
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
  initialEventId = null,
  saving,
  error,
  onSubmit,
  onCancel,
}: PostFormProps) {
  const showToast = useToast()
  useToastError(error)
  const [title, setTitle] = useState('')
  const [postDate, setPostDate] = useState(todayLocal)
  const [eventId, setEventId] = useState<string | null>(initialEventId)
  const [location, setLocation] = useState('')
  const [locationSearchOpen, setLocationSearchOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [isDraft, setIsDraft] = useState(false)
  const [images, setImages] = useState<PendingImage[]>([])
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

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

  useLayoutEffect(() => {
    const textarea = descriptionRef.current
    if (!textarea) return

    const maxHeight = 320
    textarea.style.height = 'auto'
    const contentHeight = textarea.scrollHeight
    textarea.style.height = `${Math.min(contentHeight, maxHeight)}px`
    textarea.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden'
  }, [description])

  // Any selected photo without its storage key blocks both drafts and posts.
  // The uploader offers retry or explicit removal for failed selections.
  const unsaveable = images.filter((image) => !image.image_key).length
  const storableImages = images.filter((image) => image.image_key)
  const { canSearch, searching, places, error: locationSearchError, usedFallback } = useLocationSearch(
    locationSearchOpen ? location : '',
  )
  const virtualEventMatches = /\b(virtual|online|remote)\b/i.test(location)
  const blockedFromPublishing = !isDraft && storableImages.length === 0

  function handleSubmit() {
    if (saving || unsaveable > 0) return
    if (blockedFromPublishing) {
      showToast('error', 'Add at least one saved photo to publish this recap, or save it as a draft.')
      return
    }
    onSubmit({
      // An empty box means "no title", not a title of "". The API takes null.
      title: title.trim() || null,
      description: description.trim() || null,
      location: location.trim() || null,
      post_date: postDate,
      event_id: eventId,
      published: !isDraft,
      images: images.map((image) => ({ image_key: image.image_key as string })),
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" className="text-[20px]" />
          Back to Recaps
        </button>

      </div>

      <ImageUploader key={post?.id ?? 'new'} images={images} onChange={setImages} disabled={saving} />

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

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Recap date</span>
        <CalendarDatePicker
          value={postDate}
          onChange={setPostDate}
          label="Choose recap date"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Event</span>
        <EventSelector value={eventId} onChange={setEventId} disabled={saving} management />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="recap-location" className="text-sm font-medium text-on-surface">Location</label>
        <div className="relative">
          <input
            id="recap-location"
            type="text"
            value={location}
            maxLength={LOCATION_MAX_LENGTH}
            onChange={(event) => {
              setLocation(event.target.value)
              setLocationSearchOpen(true)
            }}
            onFocus={() => setLocationSearchOpen(true)}
            onBlur={() => setLocationSearchOpen(false)}
            placeholder="Where this happened"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={locationSearchOpen && (location.trim().length > 0 || canSearch)}
            aria-controls="recap-location-suggestions"
            className="w-full rounded-lg border border-outline bg-surface-lowest px-4 py-3 text-sm text-on-surface placeholder:text-muted focus:border-outline-strong focus:outline-none"
          />
          {locationSearchOpen && (location.trim().length > 0 || canSearch) && (
            <div
              id="recap-location-suggestions"
              role="listbox"
              aria-label="Location suggestions"
              className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-outline bg-surface-lowest p-2 shadow-float"
            >
              {location.trim().length > 0 && (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setLocation(location.trim())
                    setLocationSearchOpen(false)
                  }}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-low"
                >
                  <Icon name="edit_location_alt" className="mt-0.5 text-[18px] text-muted" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-on-surface">Use “{location.trim()}”</span>
                    <span className="text-sm text-muted">Custom location</span>
                  </span>
                </button>
              )}
              {places.map((place) => (
                <button
                  key={`${place.name}-${place.address}`}
                  type="button"
                  role="option"
                  aria-selected="false"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setLocation([place.name, place.address].filter(Boolean).join(', '))
                    setLocationSearchOpen(false)
                  }}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-low"
                >
                  <Icon name="location_on" className="mt-0.5 text-[18px] text-muted" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-on-surface">{place.name}</span>
                    <span className="truncate text-sm text-muted">{place.address}</span>
                  </span>
                </button>
              ))}
              {usedFallback && places.length > 0 && (
                <p className="px-2 pb-1 pt-2 text-xs text-muted">
                  Place names © <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline">GeoNames</a> via <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY 4.0</a>
                </p>
              )}
              {virtualEventMatches && (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setLocation('Virtual')
                    setLocationSearchOpen(false)
                  }}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-low"
                >
                  <Icon name="videocam" className="mt-0.5 text-[18px] text-muted" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-on-surface">Virtual Event</span>
                    <span className="text-sm text-muted">Online or remote event</span>
                  </span>
                </button>
              )}
              {searching && <p role="status" className="px-2 py-2 text-sm text-muted">Searching locations…</p>}
              {canSearch && !searching && places.length === 0 && (
                <p className="px-2 py-2 text-sm text-muted">
                  {locationSearchError
                    ? 'Location search is unavailable. You can still use your custom location.'
                    : virtualEventMatches
                      ? 'Choose Virtual Event or keep your custom location text.'
                      : 'No locations found. Keep your custom location text.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Caption</span>
        {/*
          A plain textarea, not the rich editor the event form uses. A recap's
          caption is a paragraph under a gallery - headings, lists and inline
          images would be competing with the photographs. Line breaks survive,
          which is all this needs.
        */}
        <textarea
          ref={descriptionRef}
          value={description}
          rows={5}
          maxLength={DESCRIPTION_MAX_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Say something about the day"
          className="max-h-80 resize-y overflow-y-hidden rounded-lg border border-outline bg-surface-lowest px-4 py-3 text-sm text-on-surface placeholder:text-muted focus:border-outline-strong focus:outline-none"
        />
        <span className="self-end text-xs text-muted">
          {description.length} / {DESCRIPTION_MAX_LENGTH}
        </span>
      </label>

      {unsaveable > 0 && (
        <p className="rounded-lg bg-warning-bg px-4 py-3 text-sm font-medium text-warning">
          {unsaveable} photo{unsaveable === 1 ? '' : 's'} cannot be saved
          {STORAGE_CONFIGURED ? ' until each upload finishes successfully.' : ' until image storage is set up.'}{' '}
          Retry or remove {unsaveable === 1 ? 'it' : 'them'} before saving this recap.
        </p>
      )}

      {/* Save failures are announced through the shared top toast. */}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-end gap-2 text-sm font-medium text-on-surface-variant">
          <span>Save as draft</span>
          <button
            type="button"
            aria-label="Save as draft"
            aria-pressed={isDraft}
            onClick={() => setIsDraft((draft) => !draft)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isDraft ? 'bg-on-surface' : 'bg-surface-highest'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface-lowest shadow transition-all ${isDraft ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>
        <button
          type="button"
          disabled={saving || unsaveable > 0}
          onClick={handleSubmit}
          className="w-full rounded-lg bg-btn py-3 text-base font-semibold text-on-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : isDraft ? 'Save Draft' : post ? 'Save Changes' : 'Create Recap'}
        </button>
      </div>
    </div>
  )
}
