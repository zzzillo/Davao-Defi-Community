/**
 * The one place this app talks to the backend.
 *
 * Nothing here knows about events, blogs, or partners - it handles the parts
 * every request shares: the base URL, the bearer token, and turning a failed
 * response into an error a component can actually display. Feature services
 * build on it, so a change to error handling happens once.
 */

/**
 * Overridable per environment; the fallback is the local dev server.
 *
 * Exported so nothing else has to hardcode the host. Every second copy of this
 * string is a place that keeps pointing at localhost after a deploy.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

/** One field-level complaint from FastAPI's own validation. */
export type FieldError = {
  /** Dotted path into the request body, e.g. "title" or "end_datetime". */
  field: string
  message: string
}

/**
 * A failed request, normalised.
 *
 * FastAPI returns `detail` in three different shapes depending on who raised
 * the error, and no component should have to know which. Everything lands here
 * as a readable `message`, plus `reason` and `fields` when the server gave them.
 */
export class ApiError extends Error {
  readonly status: number
  readonly reason: string | null
  readonly fields: FieldError[]

  constructor(
    status: number,
    message: string,
    reason: string | null = null,
    fields: FieldError[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.reason = reason
    this.fields = fields
  }

  /** Their session is unknown or expired - send them to sign in. */
  get isUnauthenticated(): boolean {
    return this.status === 401
  }

  /** We know who they are and they are not allowed - explain, do not redirect. */
  get isForbidden(): boolean {
    return this.status === 403
  }
}

const GENERIC_MESSAGES: Record<number, string> = {
  401: 'Please sign in to continue',
  403: 'You do not have permission to do that',
  404: 'Not found',
  409: 'That conflicts with the current state',
  422: 'Some of the details are invalid',
  500: 'Something went wrong on the server',
}

function genericMessage(status: number): string {
  return GENERIC_MESSAGES[status] ?? `Request failed (${status})`
}

/** Turn any of FastAPI's `detail` shapes into one ApiError. */
async function toApiError(response: Response): Promise<ApiError> {
  let detail: unknown = null

  try {
    detail = ((await response.json()) as { detail?: unknown })?.detail
  } catch {
    // Empty or non-JSON body. The status code is all we have, and it is enough.
  }

  // Shape 1: raise HTTPException(404, detail="Event not found")
  if (typeof detail === 'string') {
    return new ApiError(response.status, detail)
  }

  // Shape 2: FastAPI's own validation, one entry per bad field.
  if (Array.isArray(detail)) {
    const fields: FieldError[] = detail.map((item) => {
      const entry = item as { loc?: unknown[]; msg?: string }
      const path = Array.isArray(entry.loc)
        // "body" is always the first element and means nothing to a user.
        ? entry.loc.filter((part) => part !== 'body').join('.')
        : ''
      return { field: path, message: entry.msg ?? 'Invalid value' }
    })

    return new ApiError(
      response.status,
      fields[0]?.message ?? genericMessage(response.status),
      null,
      fields,
    )
  }

  // Shape 3: this project's own errors, detail={"reason": ..., ...}
  if (detail && typeof detail === 'object') {
    const entry = detail as {
      reason?: string
      message?: string
      required_permission?: string
      required_role?: string
    }

    let message = entry.message

    if (!message && entry.required_permission) {
      // The gates send required_permission instead of prose, precisely so the
      // frontend can name what to ask an admin for.
      message = `You need the "${entry.required_permission}" permission`
    }

    if (!message && entry.required_role) {
      message = `Only ${entry.required_role}s can do that`
    }

    return new ApiError(
      response.status,
      message ?? genericMessage(response.status),
      entry.reason ?? null,
    )
  }

  return new ApiError(response.status, genericMessage(response.status))
}

/** What a query parameter is allowed to be before it becomes a string. */
export type QueryValue = string | number | boolean | undefined | null

/**
 * Build a query string, skipping anything the caller left out.
 *
 * Written once here because every module needs it and every module had it:
 * buildEventQuery and buildPostQuery were line-for-line identical apart from
 * which keys they looked at, and blogs would have made a third copy.
 *
 * THE SKIP RULE IS THE WHOLE POINT, and it is not "drop anything falsy":
 *
 * - `undefined` and `null` are dropped - the caller did not ask for this filter
 * - `''` is dropped - `search=` is not the same as omitting search; the backend
 *   would filter on an empty string and match nothing
 * - `0` is KEPT - offset=0 is page one, not a missing parameter
 * - `false` is KEPT - upcoming=false means past events, not "no preference"
 *
 * The last two are why this cannot be a one-line filter on truthiness. Both of
 * the hand-written builders this replaces got them right by spelling out every
 * key individually; getting them right once is better.
 */
export function toQueryString(params: Record<string, QueryValue>): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue

    query.set(key, String(value))
  }

  const encoded = query.toString()

  return encoded ? `?${encoded}` : ''
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** Serialised as JSON. Undefined keys disappear, which is what PATCH wants. */
  body?: unknown
  /** A Clerk session token. Omit for public endpoints. */
  token?: string | null
  /** Lets a caller cancel when the user navigates away or types again. */
  signal?: AbortSignal
}

/**
 * Make one request and return its parsed body.
 *
 * Throws ApiError on any non-2xx response, so callers can use try/catch instead
 * of checking response.ok at every call site - fetch famously does not reject
 * on a 404, and forgetting that check is how a 403 ends up rendered as data.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, signal } = options

  const headers: Record<string, string> = {}

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  // 204 No Content has no body to parse - DELETE returns one.
  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
