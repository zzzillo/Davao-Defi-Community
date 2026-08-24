import StatusBadge from '../StatusBadge'
import type { EventResponse } from '../../types/event'
import { deriveEventStatus } from '../../utils/event'

/**
 * The status pill for an event.
 *
 * Exists so the derivation happens in one place instead of at every call site,
 * and so the officials' table and the public page cannot drift into showing
 * different words for the same event.
 *
 * Renders nothing while an event is running: the "Live" pill next to it already
 * says so, and two badges repeating each other is noise.
 */
export default function EventStatusBadge({ event }: { event: EventResponse }) {
  const status = deriveEventStatus(event)

  if (status === 'Ongoing') return null

  return <StatusBadge status={status} />
}
