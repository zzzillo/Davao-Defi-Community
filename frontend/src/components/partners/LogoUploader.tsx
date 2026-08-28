import { useEffect, useRef, useState } from 'react'

import Icon from '../Icon'
import { STORAGE_CONFIGURED } from '../../services/storageService'

/**
 * The logo in the form, whether it is already stored or was just picked.
 *
 * Same two-case shape as PendingImage in the posts uploader: a stored logo has
 * a key and a URL from the API, a newly picked one has a File and a local
 * object URL. One type means the preview and the removal are written once.
 */
export type PendingLogo = {
  /** Set once stored. Null means this logo cannot be saved yet. */
  logo_key: string | null
  /** Something an <img> can display: the API's URL, or a local object URL. */
  previewUrl: string | null
  /** Present only for a file picked in this session. */
  file: File | null
}

type LogoUploaderProps = {
  logo: PendingLogo | null
  onChange: (logo: PendingLogo | null) => void
  disabled?: boolean
}

// What storage will accept. Checked here so somebody picking a PDF finds out
// immediately rather than after a save. SVG is included where the posts
// uploader excludes it: a logo is exactly the case vector art exists for.
const ACCEPTED = 'image/png,image/jpeg,image/webp,image/svg+xml'

const MAX_BYTES = 2 * 1024 * 1024

/**
 * The large square logo area at the top of the partner form.
 *
 * One image, so there is no gallery, no ordering, and no reorder buttons -
 * roughly two thirds of ImageUploader simply does not exist here. Not shared
 * with it for that reason: the two overlap in the file input and the object
 * URL cleanup, which is perhaps fifteen lines, and a component parameterised
 * over "one or many" would be harder to read than either version.
 *
 * WHILE UPLOADS DO NOT EXIST, this still lets somebody pick a file and shows
 * it. That is deliberate rather than an oversight. The alternative - a dead
 * grey box until R2 - means writing the real picker twice, and this way
 * flipping STORAGE_CONFIGURED makes the whole thing work with no change here.
 *
 * The honesty is in the labelling. On a post, photographs are one part of a
 * record that also has a caption, a date and a location, so a warning at the
 * foot of the form is proportionate. A partner is a name and a logo, so a
 * logo that will not be kept is half the record - the warning sits on the
 * preview itself, where it cannot be missed.
 */
export default function LogoUploader({
  logo,
  onChange,
  disabled = false,
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rejected, setRejected] = useState<string | null>(null)

  // An object URL holds its file in memory until revoked. Without this,
  // picking a logo and leaving the page keeps it there for as long as the tab
  // lives. Only local previews are revoked - an API URL is not ours to free.
  const localUrl = logo?.file ? logo.previewUrl : null

  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl)
    }
  }, [localUrl])

  function handleFile(file: File | undefined) {
    if (!file) return

    if (!ACCEPTED.split(',').includes(file.type)) {
      setRejected('That file is not an image. Use a PNG, JPEG, WebP or SVG.')
      return
    }

    if (file.size > MAX_BYTES) {
      setRejected('That image is larger than 2 MB. Use a smaller file.')
      return
    }

    setRejected(null)

    onChange({
      // Null until storage exists to put it in. The form reads this to decide
      // whether the logo can actually be saved.
      logo_key: null,
      previewUrl: URL.createObjectURL(file),
      file,
    })
  }

  const unsaveable = logo !== null && logo.logo_key === null

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared so picking the same file twice in a row still fires.
          event.target.value = ''
          handleFile(file)
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="group relative flex aspect-square w-56 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-outline bg-surface-low text-muted transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
      >
        {logo?.previewUrl ? (
          <>
            {/*
              object-contain, not object-cover. A logo cropped to fill a square
              is a logo with its edges cut off - and partner logos arrive in
              every aspect ratio there is.
            */}
            <img
              src={logo.previewUrl}
              alt=""
              className="h-full w-full object-contain p-3"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/50 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Icon name="photo_camera" className="text-[14px]" />
              Replace
            </span>
          </>
        ) : (
          <>
            <Icon name="add_photo_alternate" className="text-[28px]" />
            <span className="text-sm font-medium">Upload partner logo</span>
            <span className="text-xs">PNG, JPEG, WebP or SVG</span>
          </>
        )}
      </button>

      {logo && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className="text-xs font-semibold text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-60"
        >
          Remove logo
        </button>
      )}

      {rejected && (
        <p className="max-w-56 text-center text-xs font-medium text-error">{rejected}</p>
      )}

      {/*
        Directly under the preview rather than at the foot of the form. A
        partner is a name and a logo; somebody who picks a logo, saves, and
        finds only the name kept has lost half of what they thought they did.
      */}
      {unsaveable && (
        <p className="max-w-64 text-center text-xs font-medium text-warning">
          {STORAGE_CONFIGURED
            ? 'This logo could not be uploaded. The name will still save.'
            : 'Image storage is not set up yet, so this logo will not be saved. The partner name saves normally.'}
        </p>
      )}
    </div>
  )
}
