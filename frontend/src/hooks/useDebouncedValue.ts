import { useEffect, useState } from 'react'

/**
 * The value, but only after it has stopped changing for `delayMs`.
 *
 * Search boxes are the reason this exists. Bound directly to a query parameter,
 * every keystroke would start a request; "hackathon" is nine of them, eight of
 * which nobody will read. The fetch hooks already abort superseded requests, so
 * the answers stay correct either way - this stops us asking in the first place.
 *
 * Not events-specific. Any filter input can use it.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)

    // Cleanup runs before the next effect, so a keystroke inside the window
    // cancels the pending update instead of queueing a second one.
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
