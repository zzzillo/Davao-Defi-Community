import { ApiError, apiRequest, toQueryString } from './api'

export type MediaPurpose = 'profile_photo' | 'blog_cover' | 'event_banner' | 'recap_image' | 'partner_logo'

export type MediaUploadResponse = {
  id: string
  storage_key: string
  purpose: MediaPurpose
  public_url: string
  content_type: string
  byte_size: number
  width: number
  height: number
  validation_status: 'valid'
}

export type UploadImageResult = MediaUploadResponse & {
  /** Aliases used by existing content forms. */
  image_key: string
  image_url: string
}

export type UploadImageOptions = {
  purpose?: MediaPurpose
  ownerUserId?: string
  signal?: AbortSignal
}

/** Kept for callers that want to distinguish a missing R2 setup. */
export class StorageNotConfiguredError extends ApiError {
  constructor() {
    super(503, 'Image storage is not available right now.', 'media_storage_not_configured')
    this.name = 'StorageNotConfiguredError'
  }
}

/** Browser uploads are sent through the authenticated API; storage is server-only. */
export const STORAGE_CONFIGURED = true
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Validate the obvious client-side constraints, then let the backend inspect bytes. */
export async function uploadImage(
  file: File,
  token: string,
  options: UploadImageOptions = {},
): Promise<UploadImageResult> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new ApiError(415, 'Choose a JPEG, PNG, or WebP image.', 'unsupported_image_type')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, 'Choose an image smaller than 10 MiB.', 'image_too_large')
  }
  if (file.size === 0) {
    throw new ApiError(422, 'The selected image is empty.', 'empty_image')
  }

  const purpose = options.purpose ?? 'recap_image'
  const path = `/media/uploads${toQueryString({
    purpose,
    owner_user_id: options.ownerUserId,
  })}`
  const uploaded = await apiRequest<MediaUploadResponse>(path, {
    method: 'POST',
    token,
    rawBody: file,
    contentType: file.type,
    signal: options.signal,
  })

  return {
    ...uploaded,
    image_key: uploaded.storage_key,
    image_url: uploaded.public_url,
  }
}
