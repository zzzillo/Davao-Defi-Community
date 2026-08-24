/**
 * Turning an event from the API into things a person can read.
 *
 * Pure functions: no React, no fetch. Pages filter with them, components render
 * with them, and they can be reasoned about on their own.
 */

import type { EventResponse } from '../types/event'

/**
 * What an event looks like right now.
 *
 * Derived from `published` plus the timestamps rather than stored in a column.
 * A stored status would need a job running all day to flip rows from Upcoming
 * to Completed, and would be wrong in between runs. This is right every time it
 * is asked, and costs one comparison.
 *
 * Every value here also exists in StatusBadge's Status union, so the badge
 * renders these directly.
 */
export type EventStatus = 'Draft' | 'Upcoming' | 'Ongoing' | 'Completed'

/**
 * Where an event sits relative to now.
 *
 * `now` is a parameter so this stays a pure function - the same inputs always
 * give the same answer, which is what makes it testable.
 *
 * An event with no end_datetime is treated as ending when it starts, so it
 * reads Completed the moment it begins. The form always collects an end time,
 * so this only affects events created directly through the API.
 */
export function deriveEventStatus(
  event: EventResponse,
  now: Date = new Date(),
): EventStatus {
  if (!event.published) return 'Draft'

  const start = new Date(event.start_datetime)
  const end = event.end_datetime ? new Date(event.end_datetime) : start

  if (now < start) return 'Upcoming'
  if (now <= end) return 'Ongoing'

  return 'Completed'
}

/**
 * "Oct 15, 2026", in the reader's own timezone.
 *
 * Passing `undefined` as the locale means the browser's. The stored value is an
 * instant in UTC; this is the first point at which it becomes a wall-clock date
 * for one particular person - which is exactly why the column is TIMESTAMPTZ.
 */
export function formatEventDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "09:00 AM", in the reader's own timezone. */
export function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "09:00 AM - 11:00 AM", or just the start when there is no end. */
export function formatEventTimeRange(event: EventResponse): string {
  const start = formatEventTime(event.start_datetime)

  if (!event.end_datetime) return start

  return `${start} - ${formatEventTime(event.end_datetime)}`
}

