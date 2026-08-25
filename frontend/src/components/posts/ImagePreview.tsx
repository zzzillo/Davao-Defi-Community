import { useEffect } from 'react'
import Icon from '../Icon'
import type { PostImage } from '../../types/post'

type ImagePreviewProps = {
  images: PostImage[]
  /** Which image is showing. Null closes the preview. */
  index: number | null
  onSelect: (index: number) => void
  onClose: () => void
}

/**
 * The full-size view of one photograph, over a dimmed page.
 *
 * Kept separate from ImageGrid so the grid stays a grid. This owns nothing:
 * which image is open lives with whoever opened it, which is what lets the
 * same preview serve the public gallery and the officials' form.
 */
export default function ImagePreview({
  images,
  index,
  onSelect,
  onClose,
}: ImagePreviewProps) {
  const open = index !== null && images.length > 0

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()

      // Wrapping with modulo rather than stopping at the ends: in a photo
      // album, arriving back at the first picture is friendlier than a key
      // that silently does nothing.
      if (event.key === 'ArrowRight') onSelect(((index as number) + 1) % images.length)
      if (event.key === 'ArrowLeft') {
        onSelect(((index as number) - 1 + images.length) % images.length)
      }
    }

    document.addEventListener('keydown', onKeyDown)

    // The page behind a lightbox must not scroll, or a trackpad flick moves
    // the article instead of doing nothing.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, index, images.length, onSelect, onClose])

  if (!open) return null

  const current = images[index as number]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${(index as number) + 1} of ${images.length}`}
      // Clicking the backdrop closes. The image below stops propagation, so
      // clicking the photograph itself does not.
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity hover:opacity-70"
      >
        <Icon name="close" className="text-[24px]" />
      </button>

      {images.length > 1 && (
        <button
          type="button"
          aria-label="Previous photo"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(((index as number) - 1 + images.length) % images.length)
          }}
          className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white transition-opacity hover:opacity-70"
        >
          <Icon name="chevron_left" className="text-[28px]" />
        </button>
      )}

      {current.image_url ? (
        <img
          src={current.image_url}
          alt=""
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
      ) : (
        // Storage is not configured, so the key cannot be resolved to a URL.
        <p className="rounded-lg bg-black/40 px-6 py-4 text-sm text-white">
          This image is not available.
        </p>
      )}

      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(event) => {
              event.stopPropagation()
              onSelect(((index as number) + 1) % images.length)
            }}
            className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white transition-opacity hover:opacity-70"
          >
            <Icon name="chevron_right" className="text-[28px]" />
          </button>

          <p className="absolute bottom-6 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
            {(index as number) + 1} / {images.length}
          </p>
        </>
      )}
    </div>
  )
}
