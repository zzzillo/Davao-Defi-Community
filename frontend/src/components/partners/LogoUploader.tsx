import { useEffect, useRef, useState } from 'react'

import Icon from '../Icon'
import { uploadImage } from '../../services/storageService'
import { useAppAuth } from '../../auth/useAppAuth'
import { useToastError } from '../../hooks/useToast'

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
  uploading?: boolean
  uploadError?: string | null
}

type LogoUploaderProps = {
  logo: PendingLogo | null
  onChange: (logo: PendingLogo | null) => void
  disabled?: boolean
}

const ACCEPTED = 'image/png,image/jpeg,image/webp'
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024

/**
 * The large square logo area at the top of the partner form.
 *
 * One image, so there is no gallery, no ordering, and no reorder buttons -
 * roughly two thirds of ImageUploader simply does not exist here. Not shared
 * with it for that reason: the two overlap in the file input and the object
 * URL cleanup, which is perhaps fifteen lines, and a component parameterised
 * over "one or many" would be harder to read than either version.
 *
 * Uploads are tied to this selection; a file must be stored successfully before
 * the parent form can save the partner record.
 */
export default function LogoUploader({
  logo,
  onChange,
  disabled = false,
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<AbortController | null>(null)
  const uploadAttemptRef = useRef(0)
  const selectedFileRef = useRef<File | null>(logo?.file ?? null)
  const { getToken } = useAppAuth()
  const [rejected, setRejected] = useState<string | null>(null)
  useToastError(logo?.uploadError)
  useToastError(rejected)

  // An object URL holds its file in memory until revoked. Without this,
  // picking a logo and leaving the page keeps it there for as long as the tab
  // lives. Only local previews are revoked - an API URL is not ours to free.
  const localUrl = logo?.file ? logo.previewUrl : null

  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl)
    }
  }, [localUrl])

  useEffect(() => () => uploadRef.current?.abort(), [])

  async function upload(file: File, previewUrl: string) {
    uploadRef.current?.abort()
    const controller = new AbortController()
    uploadRef.current = controller
    const attempt = ++uploadAttemptRef.current
    const isCurrent = () => (
      uploadAttemptRef.current === attempt
      && selectedFileRef.current === file
      && !controller.signal.aborted
    )

    const pending: PendingLogo = {
      logo_key: null,
      previewUrl,
      file,
      uploading: true,
      uploadError: null,
    }
    onChange(pending)

    try {
      const token = await getToken()
      if (!token) throw new Error('Your sign-in expired. Sign in again before uploading.')
      if (controller.signal.aborted) return
      const uploaded = await uploadImage(file, token, {
        purpose: 'partner_logo',
        signal: controller.signal,
      })
      if (!isCurrent()) return

      const stored: PendingLogo = {
        logo_key: uploaded.storage_key,
        previewUrl: uploaded.public_url,
        file: null,
        uploading: false,
        uploadError: null,
      }
      selectedFileRef.current = null
      onChange(stored)
    } catch (caught) {
      if (!isCurrent()) return
      const failed: PendingLogo = {
        ...pending,
        uploading: false,
        uploadError: caught instanceof Error ? caught.message : 'This logo could not be uploaded.',
      }
      onChange(failed)
    } finally {
      if (uploadRef.current === controller) uploadRef.current = null
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return

    if (!ACCEPTED_TYPES.has(file.type)) {
      setRejected('Choose a JPEG, PNG, or WebP image. SVG files are not accepted.')
      return
    }

    if (file.size === 0 || file.size > MAX_BYTES) {
      setRejected(file.size === 0 ? 'Choose an image that is not empty.' : 'Choose an image no larger than 10 MiB.')
      return
    }

    setRejected(null)
    const previewUrl = URL.createObjectURL(file)
    selectedFileRef.current = file
    void upload(file, previewUrl)
  }

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

      <div className="relative aspect-square w-56">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-outline bg-surface-low text-muted transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
        >
          {logo?.previewUrl ? (
            <>
              {/* Keep the entire logo visible regardless of its aspect ratio. */}
              <img
                src={logo.previewUrl}
                alt=""
                onError={(event) => { event.currentTarget.hidden = true }}
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
              <span className="text-xs">JPEG, PNG or WebP · up to 10 MiB</span>
            </>
          )}
        </button>
        {logo && (
          <button
            type="button"
            aria-label="Remove partner logo"
            title="Remove logo"
            disabled={disabled}
            onClick={() => {
              uploadAttemptRef.current += 1
              uploadRef.current?.abort()
              uploadRef.current = null
              selectedFileRef.current = null
              onChange(null)
            }}
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-lowest/90 text-on-surface shadow-sm transition-colors hover:bg-surface-low disabled:opacity-60"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        )}
      </div>

      {logo?.uploading && (
        <p role="status" className="max-w-64 text-center text-xs font-medium text-on-surface-variant">
          Uploading logo…
        </p>
      )}

      {logo?.uploadError && (
        <div className="flex max-w-64 flex-col items-center gap-2 text-center text-xs font-medium">
          {logo.file && logo.previewUrl && (
            <button type="button" disabled={disabled} onClick={() => void upload(logo.file!, logo.previewUrl!)} className="underline underline-offset-2">
              Retry upload
            </button>
          )}
        </div>
      )}

    </div>
  )
}
