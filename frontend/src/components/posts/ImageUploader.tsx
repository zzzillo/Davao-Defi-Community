import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import Icon from '../Icon'
import { STORAGE_CONFIGURED, uploadImage } from '../../services/storageService'
import { useAppAuth } from '../../auth/useAppAuth'
import { useToastError } from '../../hooks/useToast'

/**
 * One image in the form, whether it is already saved or was just picked.
 *
 * The two cases differ in exactly one way: a saved image has an image_key and
 * a URL from the API, a newly picked one has a File and a local object URL.
 * Keeping them in one type means the grid, the reordering and the removal are
 * written once rather than twice.
 */
export type PendingImage = {
  /** Local, stable, and only for React keys and reordering. Not the API's id. */
  id: string
  /** Set once stored. Null means this image cannot be saved yet. */
  image_key: string | null
  /** Something an <img> can display: the API's URL, or a local object URL. */
  previewUrl: string | null
  /** Present only for a file picked in this session. */
  file: File | null
  /** True while the selected file is being stored. */
  uploading?: boolean
  /** A selected file remains unsaveable until retried or removed. */
  uploadError?: string | null
}

type ImageUploaderProps = {
  images: PendingImage[]
  onChange: Dispatch<SetStateAction<PendingImage[]>>
  disabled?: boolean
}

const MAX_IMAGES = 30

// Matches the image formats and size accepted by the backend media service.
const ACCEPTED = 'image/png,image/jpeg,image/webp'
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

let localIdCounter = 0

function nextLocalId(): string {
  localIdCounter += 1
  return `local-${localIdCounter}`
}

/**
 * The large image area at the top of the form.
 *
 * Reordering is done with move-earlier and move-later buttons rather than drag
 * and drop. Dragging is nicer with a mouse and unusable without one - it needs a
 * library or a lot of custom code to be operable by keyboard, and a photograph
 * album that a screen reader user cannot reorder is not finished. Buttons are
 * plain, accessible, and can gain dragging later without changing this
 * component's contract.
 *
 * Position in the list is the order the API stores, so moving an image here is
 * the whole of "reorder" - there is no separate index to keep in sync, and
 * moving an image into first place makes it the cover.
 */
export default function ImageUploader({
  images,
  onChange,
  disabled = false,
}: ImageUploaderProps) {
  useToastError(images.find((image) => image.uploadError)?.uploadError)
  const inputRef = useRef<HTMLInputElement>(null)
  const { getToken } = useAppAuth()
  const imagesRef = useRef(images)
  const onChangeRef = useRef(onChange)
  const previousImagesRef = useRef(images)
  const uploadControllersRef = useRef(new Map<string, AbortController>())
  const uploadAttemptsRef = useRef(new Map<string, number>())
  const [rejected, setRejected] = useState<string | null>(null)
  useToastError(rejected)
  const [activeIndex, setActiveIndex] = useState(0)

  imagesRef.current = images
  onChangeRef.current = onChange

  // A form can hydrate a different post without unmounting this uploader.
  // Cancel orphaned requests and release previews no longer in the selection.
  useEffect(() => {
    const currentIds = new Set(images.map((image) => image.id))
    for (const previous of previousImagesRef.current) {
      if (!currentIds.has(previous.id) && previous.file && previous.previewUrl) {
        URL.revokeObjectURL(previous.previewUrl)
      }
    }
    previousImagesRef.current = images

    for (const [id, controller] of uploadControllersRef.current) {
      if (!currentIds.has(id)) {
        controller.abort()
        uploadControllersRef.current.delete(id)
        uploadAttemptsRef.current.set(id, (uploadAttemptsRef.current.get(id) ?? 0) + 1)
      }
    }
  }, [images])

  // Pending uploads are cancelled when the form leaves the page. Only local
  // object URLs are revoked; a stored API URL is not ours to release.
  useEffect(() => {
    const uploadControllers = uploadControllersRef.current
    return () => {
      for (const controller of uploadControllers.values()) controller.abort()
      for (const image of imagesRef.current) {
        if (image.file && image.previewUrl) URL.revokeObjectURL(image.previewUrl)
      }
    }
  }, [])

  function updateImage(id: string, update: (image: PendingImage) => PendingImage) {
    const next = imagesRef.current.map((image) => image.id === id ? update(image) : image)
    imagesRef.current = next
    onChangeRef.current(next)
  }

  async function uploadPendingImage(image: PendingImage) {
    if (!image.file) return

    uploadControllersRef.current.get(image.id)?.abort()
    const controller = new AbortController()
    uploadControllersRef.current.set(image.id, controller)
    const attempt = (uploadAttemptsRef.current.get(image.id) ?? 0) + 1
    uploadAttemptsRef.current.set(image.id, attempt)
    const file = image.file
    const isCurrent = () => (
      uploadAttemptsRef.current.get(image.id) === attempt
      && !controller.signal.aborted
      && imagesRef.current.some((candidate) => candidate.id === image.id && candidate.file === file)
    )

    updateImage(image.id, (current) => ({ ...current, uploading: true, uploadError: null }))

    try {
      const token = await getToken()
      if (!token) throw new Error('Your sign-in expired. Sign in again before uploading.')
      if (controller.signal.aborted) return

      const uploaded = await uploadImage(file, token, {
        purpose: 'recap_image',
        signal: controller.signal,
      })
      if (!isCurrent()) return

      if (image.previewUrl) URL.revokeObjectURL(image.previewUrl)
      updateImage(image.id, (current) => ({
        ...current,
        image_key: uploaded.image_key,
        previewUrl: uploaded.image_url,
        file: null,
        uploading: false,
        uploadError: null,
      }))
    } catch (caught) {
      if (!isCurrent()) return
      updateImage(image.id, (current) => ({
        ...current,
        uploading: false,
        uploadError: caught instanceof Error ? caught.message : 'This photo could not be uploaded.',
      }))
    } finally {
      if (uploadControllersRef.current.get(image.id) === controller) {
        uploadControllersRef.current.delete(image.id)
      }
    }
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const accepted: File[] = []
    const reasons = new Set<string>()
    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        reasons.add('Only JPEG, PNG, and WebP photos are accepted.')
      } else if (file.size === 0) {
        reasons.add('Empty image files were skipped.')
      } else if (file.size > MAX_UPLOAD_BYTES) {
        reasons.add('Images must be no larger than 10 MiB.')
      } else {
        accepted.push(file)
      }
    }

    const currentImages = imagesRef.current
    const room = MAX_IMAGES - currentImages.length
    if (accepted.length > room) {
      reasons.add(`Only ${room} more image${room === 1 ? '' : 's'} can be added.`)
    }

    const added = accepted.slice(0, Math.max(0, room)).map<PendingImage>((file) => ({
      id: nextLocalId(),
      image_key: null,
      previewUrl: URL.createObjectURL(file),
      file,
      uploading: true,
      uploadError: null,
    }))

    const next = [...currentImages, ...added]
    imagesRef.current = next
    if (added.length > 0) {
      onChangeRef.current(next)
      setActiveIndex(next.length - added.length)
      added.forEach((image) => { void uploadPendingImage(image) })
    }
    setRejected(reasons.size > 0 ? [...reasons].join(' ') : null)
  }

  function removeAt(index: number) {
    const currentImages = imagesRef.current
    const image = currentImages[index]
    if (!image) return
    uploadControllersRef.current.get(image.id)?.abort()
    uploadControllersRef.current.delete(image.id)
    uploadAttemptsRef.current.set(image.id, (uploadAttemptsRef.current.get(image.id) ?? 0) + 1)
    const next = currentImages.filter((_, position) => position !== index)
    imagesRef.current = next
    onChangeRef.current(next)
    setActiveIndex((current) =>
      current > index ? current - 1 : current === index ? Math.max(0, index - 1) : current,
    )
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction

    const currentImages = imagesRef.current
    if (target < 0 || target >= currentImages.length) return

    const reordered = [...currentImages]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    imagesRef.current = reordered
    onChangeRef.current(reordered)
    setActiveIndex(target)
  }

  const full = images.length >= MAX_IMAGES
  const selectedIndex = Math.min(activeIndex, Math.max(0, images.length - 1))
  const selectedImage = images[selectedIndex]

  return (
    <div className="flex flex-col gap-3">
      {!STORAGE_CONFIGURED && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-bg px-4 py-3 text-sm font-medium text-warning">
          <Icon name="info" className="text-[18px]" />
          <span>
            Image storage is not set up yet. Photos can be previewed here, but they
            must be removed before the post can be saved.
          </span>
        </p>
      )}

      {images.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-strong text-muted transition-colors hover:bg-surface-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="add_photo_alternate" className="text-[40px]" />
          <span className="text-sm font-medium">Add photos</span>
          <span className="text-xs">JPEG, PNG or WebP · up to 10 MiB each</span>
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-surface-container">
            {selectedImage?.previewUrl ? (
              <img
                src={selectedImage.previewUrl}
                alt={`Event photo ${selectedIndex + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-muted">
                <Icon name="image" className="text-[40px]" />
              </span>
            )}

            {selectedIndex === 0 && (
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                Cover
              </span>
            )}

            {selectedImage?.uploading && (
              <span role="status" className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white">
                Uploading photo…
              </span>
            )}
            {selectedImage?.uploadError && (
              <div className="absolute right-3 top-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg bg-black/75 px-3 py-2 text-xs text-white">
                {selectedImage.file && (
                  <button type="button" onClick={() => void uploadPendingImage(selectedImage)} className="shrink-0 font-semibold underline underline-offset-2">
                    Retry
                  </button>
                )}
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <button
                type="button"
                aria-label={`Move photo ${selectedIndex + 1} earlier`}
                disabled={selectedIndex === 0 || disabled}
                onClick={() => move(selectedIndex, -1)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-opacity hover:opacity-70 disabled:opacity-30"
              >
                <Icon name="arrow_upward" className="text-[20px]" />
              </button>
              <button
                type="button"
                aria-label={`Remove photo ${selectedIndex + 1}`}
                disabled={disabled}
                onClick={() => removeAt(selectedIndex)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-opacity hover:opacity-70"
              >
                <Icon name="delete" className="text-[20px]" />
              </button>
              <button
                type="button"
                aria-label={`Move photo ${selectedIndex + 1} later`}
                disabled={selectedIndex === images.length - 1 || disabled}
                onClick={() => move(selectedIndex, 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-opacity hover:opacity-70 disabled:opacity-30"
              >
                <Icon name="arrow_downward" className="text-[20px]" />
              </button>
            </div>
          </div>

          <div className="flex w-full min-w-0 items-center justify-center gap-2">
            <button
              type="button"
              aria-label="Previous photo"
              disabled={selectedIndex === 0}
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-lowest text-primary shadow-sm transition-opacity hover:opacity-75 disabled:opacity-30"
            >
              <Icon name="chevron_left" className="text-[22px]" />
            </button>

            <div className="flex w-fit min-w-0 max-w-[calc(100%-5.5rem)] items-center gap-2 overflow-x-auto py-1">
              {images.map((image, index) => (
                <div key={image.id} className="relative h-20 w-28 shrink-0">
                  <button
                    type="button"
                    aria-label={`Show photo ${index + 1}`}
                    aria-pressed={index === selectedIndex}
                    onClick={() => setActiveIndex(index)}
                    className={`h-full w-full overflow-hidden rounded-lg bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      index === selectedIndex
                        ? 'border-2 border-primary'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    {image.previewUrl ? (
                      <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-muted">
                        <Icon name="image" className="text-[22px]" />
                      </span>
                    )}
                  </button>
                  {image.uploading && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Uploading
                    </span>
                  )}
                  {image.uploadError && image.file && (
                    <button
                      type="button"
                      aria-label={`Retry upload for photo ${index + 1}`}
                      onClick={() => void uploadPendingImage(image)}
                      className="absolute bottom-1 left-1 rounded bg-error px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove photo ${index + 1}`}
                    title={`Remove photo ${index + 1}`}
                    disabled={disabled}
                    onClick={() => removeAt(index)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon name="close" className="text-[16px]" />
                  </button>
                </div>
              ))}

              {!full && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => inputRef.current?.click()}
                  className="flex h-20 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-outline-strong text-muted transition-colors hover:bg-surface-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="add" className="text-[22px]" />
                  <span className="text-xs font-medium">Add</span>
                </button>
              )}
            </div>

            <button
              type="button"
              aria-label="Next photo"
              disabled={selectedIndex >= images.length - 1}
              onClick={() => setActiveIndex((index) => Math.min(images.length - 1, index + 1))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-lowest text-primary shadow-sm transition-opacity hover:opacity-75 disabled:opacity-30"
            >
              <Icon name="chevron_right" className="text-[22px]" />
            </button>
          </div>

          {images.length > 1 && (
            <div className="flex justify-center gap-2">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Show photo ${index + 1}`}
                  aria-pressed={index === selectedIndex}
                  onClick={() => setActiveIndex(index)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    index === selectedIndex ? 'bg-primary' : 'bg-outline-strong hover:bg-muted'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-muted">
          {images.length} of {MAX_IMAGES}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        hidden
        onChange={(event) => {
          addFiles(event.target.files)
          // Reset, or picking the same file twice in a row fires no change
          // event the second time.
          event.target.value = ''
        }}
      />
    </div>
  )
}
