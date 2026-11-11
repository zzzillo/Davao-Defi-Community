import { describe, expect, it, vi } from 'vitest'
import { runResourceEventStream } from './realtime'

function bodyFrom(chunks: string[]) {
  let position = 0
  const reader = {
    read: vi.fn(async () => {
      if (position >= chunks.length) return { done: true, value: undefined }
      return { done: false, value: new TextEncoder().encode(chunks[position++]) }
    }),
    cancel: vi.fn(async () => {}),
    releaseLock: vi.fn(),
  }
  return { body: { getReader: () => reader } as unknown as ReadableStream<Uint8Array>, reader }
}

describe('authenticated resource event stream', () => {
  it('sends the session token and dispatches only resource names', async () => {
    const controller = new AbortController()
    const stream = bodyFrom([
      ': connected\n\nevent: resource_changed\ndata: {"resource":"events"}\n\n',
    ])
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, body: stream.body }) as Response)
    const onResource = vi.fn(() => controller.abort())

    await runResourceEventStream({
      endpoint: 'https://api.example.test/realtime/events',
      getToken: async () => 'session-token',
      onResource,
      signal: controller.signal,
      fetcher,
    })

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/realtime/events',
      expect.objectContaining({
        headers: { Authorization: 'Bearer session-token', Accept: 'text/event-stream' },
        signal: controller.signal,
        cache: 'no-store',
      }),
    )
    expect(onResource).toHaveBeenCalledWith('events')
  })

  it('reconnects after the stream ends and stops when the session is aborted', async () => {
    const controller = new AbortController()
    const ended = bodyFrom([])
    const event = bodyFrom(['event: resource_changed\ndata: {"resource":"users"}\n\n'])
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, body: ended.body } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, body: event.body } as Response)
    const wait = vi.fn(async () => {})
    const onResource = vi.fn(() => controller.abort())
    const onReconnect = vi.fn()

    await runResourceEventStream({
      endpoint: '/realtime/events',
      getToken: async () => 'fresh-token',
      onResource,
      onReconnect,
      signal: controller.signal,
      fetcher,
      wait,
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(1000, controller.signal)
    expect(onReconnect).toHaveBeenCalledTimes(1)
    expect(onResource).toHaveBeenCalledWith('users')
  })

  it('does not reconnect after cleanup aborts a pending connection', async () => {
    const controller = new AbortController()
    let sawSignal: AbortSignal | undefined
    const fetcher = vi.fn((_url: RequestInfo | URL, init: RequestInit = {}) => {
      sawSignal = init.signal as AbortSignal
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    })
    const wait = vi.fn(async () => {})
    const pending = runResourceEventStream({
      endpoint: '/realtime/events',
      getToken: async () => 'fresh-token',
      onResource: vi.fn(),
      signal: controller.signal,
      fetcher,
      wait,
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.abort()
    await pending

    expect(sawSignal?.aborted).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(wait).not.toHaveBeenCalled()
  })
})
