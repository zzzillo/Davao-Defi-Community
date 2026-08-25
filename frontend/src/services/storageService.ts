/**
 * Putting files into storage, and the one seam R2 will land behind.
 *
 * The rest of the app never learns where images live. It hands a File to
 * uploadImage and receives back an image_key - the same opaque string the
 * backend stores and resolves. When R2 arrives, the body of that one function
 * changes and no component, hook, or type changes with it.
 *
 * Until then it refuses honestly rather than pretending. A stub that returned
 * a fabricated key would let a post save with images pointing at nothing,
 * which fails later, somewhere else, with no clue why.
 */

/** Thrown by uploadImage while no storage provider is configured. */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Image upload is not set up yet, so photos cannot be saved.')
    this.name = 'StorageNotConfiguredError'
  }
}

/**
 * Whether uploads can succeed right now.
 *
 * A single flag rather than a try/catch at every call site: forms use it to
 * explain the situation up front, instead of letting somebody pick twenty
 * photographs and only then discovering none of them can be kept.
 *
 * Flips to true in the same commit that implements uploadImage.
 */
export const STORAGE_CONFIGURED = false

/**
 * Store one image and return the key the API should record.
 *
 * The signature is the finished one. When R2 lands, this will ask the backend
 * for a short-lived upload URL, PUT the file straight to the bucket, and
 * return the key the backend minted - so the file never travels through the
 * API server, and no bucket credential ever reaches the browser.
 */
export async function uploadImage(
  _file: File,
  _token: string,
): Promise<{ image_key: string }> {
  throw new StorageNotConfiguredError()
}
