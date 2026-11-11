import { API_BASE_URL } from './api'

const RESOURCE_EVENTS = new Set(['events', 'posts', 'blogs', 'partners', 'users'])

type ResourceEvent = 'events' | 'posts' | 'blogs' | 'partners' | 'users'
type StreamFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type RetryWait = (milliseconds: number, signal: AbortSignal) => Promise<void>

export type ResourceEventStreamOptions = {
  endpoint?: string
  getToken: () => Promise<string | null>
  onResource: (resource: ResourceEvent) => void
  onReconnect?: () => void
  signal: AbortSignal
  fetcher?: StreamFetcher
  wait?: RetryWait
}

function abortableWait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, milliseconds)
    signal.addEventListener('abort', finish, { once: true })
  })
}

function resourceFromFrame(frame: string): ResourceEvent | null {
  let eventName = 'message'
  const data: string[] = []
  for (const line of frame.split('\n')) {
    if (!line || line.startsWith(':')) continue
    const separator = line.indexOf(':')
    const field = separator < 0 ? line : line.slice(0, separator)
    const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '')
    if (field === 'event') eventName = value
    if (field === 'data') data.push(value)
  }
  if (eventName !== 'resource_changed' || data.length === 0) return null
  try {
    const parsed = JSON.parse(data.join('\n')) as { resource?: unknown }
    return typeof parsed.resource === 'string' && RESOURCE_EVENTS.has(parsed.resource)
      ? parsed.resource as ResourceEvent
      : null
  } catch {
    return null
  }
}

async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onResource: (resource: ResourceEvent) => void,
  signal: AbortSignal,
): Promise<boolean> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let receivedEvent = false

  const cancelReader = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancelReader, { once: true })

  const dispatchFrames = () => {
    buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const resource = resourceFromFrame(buffer.slice(0, boundary))
      buffer = buffer.slice(boundary + 2)
      if (resource) {
        receivedEvent = true
        onResource(resource)
      }
      boundary = buffer.indexOf('\n\n')
    }
  }

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      dispatchFrames()
    }
    buffer += decoder.decode()
    dispatchFrames()
    if (buffer.trim()) {
      const resource = resourceFromFrame(buffer)
      if (resource) {
        receivedEvent = true
        onResource(resource)
      }
    }
  } finally {
    signal.removeEventListener('abort', cancelReader)
    try { reader.releaseLock() } catch { /* The reader may already be cancelled. */ }
  }
  return receivedEvent
}

/** Run an authenticated fetch-based SSE connection until its owner aborts it. */
export async function runResourceEventStream({
  endpoint = `${API_BASE_URL}/realtime/events`,
  getToken,
  onResource,
  onReconnect,
  signal,
  fetcher = fetch,
  wait = abortableWait,
}: ResourceEventStreamOptions): Promise<void> {
  let attempt = 0
  let connectedBefore = false
  while (!signal.aborted) {
    try {
      const token = await getToken()
      if (!token || signal.aborted) return
      const response = await fetcher(endpoint, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        cache: 'no-store',
        signal,
      })
      if (!response.ok || !response.body) throw new Error('Realtime stream unavailable')
      if (connectedBefore) onReconnect?.()
      connectedBefore = true
      if (await consumeStream(response.body, onResource, signal)) attempt = 0
    } catch {
      if (signal.aborted) return
    }

    if (signal.aborted) return
    const delay = Math.min(1000 * (2 ** attempt), 30_000)
    await wait(delay, signal)
    attempt = Math.min(attempt + 1, 5)
  }
}
