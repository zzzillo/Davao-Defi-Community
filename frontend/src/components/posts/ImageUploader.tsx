import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import { STORAGE_CONFIGURED } from '../../services/storageService'

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
}

type ImageUploaderProps = {
  images: PendingImage[]
  onChange: (images: PendingImage[]) => void
  disabled?: boolean
}

const MAX_IMAGES = 30

// Matches what the backend's sanitiser and storage would accept. Checked here
// so somebody picking a PDF finds out immediately rather than after a save.
const ACCEPTED = 'image/png,image/jpeg,image/webp,image/gif'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const [rejected, setRejected] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  // Object URLs hold a reference to the file until they are revoked. Without
  // this, picking twenty photographs and leaving the page keeps all twenty in
  // memory for as long as the tab lives.
  useEffect(() => {
    return () => {
      for (const image of images) {
        if (image.file && image.previewUrl) URL.revokeObjectURL(image.previewUrl)
      }
    }
    // Deliberately on unmount only. Re-running whenever `images` changes would
    // revoke URLs that are still on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const room = MAX_IMAGES - images.length
    const accepted = Array.from(files).filter((file) => file.type.startsWith('image/'))

    setRejected(
      accepted.length < files.length
        ? 'Some files were skipped because they are not images.'
        : files.length > room
          ? `Only ${room} more image${room === 1 ? '' : 's'} can be added.`
          : null,
    )

    const added = accepted.slice(0, Math.max(0, room)).map<PendingImage>((file) => ({
      id: nextLocalId(),
      // No key until something stores the file. The form uses this to know it
      // cannot save yet.
      image_key: null,
      previewUrl: URL.createObjectURL(file),
      file,
    }))

    if (added.length > 0) onChange([...images, ...added])
  }

  function removeAt(index: number) {
    const image = images[index]

    // Only local previews own their URL. An API URL must not be revoked.
    if (image.file && image.previewUrl) URL.revokeObjectURL(image.previewUrl)

    onChange(images.filter((_, position) => position !== index))
    setActiveIndex((current) =>
      current > index ? current - 1 : current === index ? Math.max(0, index - 1) : current,
    )
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction

    if (target < 0 || target >= images.length) return

    const reordered = [...images]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    onChange(reordered)
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
            will not be saved with the post.
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
          <span className="text-xs">PNG, JPG, WEBP or GIF</span>
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-surface-container">
            {selectedImage?.previewUrl ? (
              <img
                src={selectedImage.previewUrl}
                alt={`Recap photo ${selectedIndex + 1}`}
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

      {rejected && <p className="text-sm text-error">{rejected}</p>}

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
