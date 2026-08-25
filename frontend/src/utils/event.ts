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

/**
 * Strip HTML down to readable text.
 *
 * The event form stores rich HTML in `description`, because throwing away what
 * someone typed into a rich text editor is not an option. Anywhere that shows a
 * one-line preview wants the words without the tags.
 *
 * This is not a sanitiser and must never be used as one - it is a regex over
 * markup, which is exactly the wrong tool for deciding what is safe. Rendering
 * a description as real HTML is safe for a different reason: the backend cleans
 * it on write, in app/services/html_service.py. See the public EventDetails
 * page, which is the only place that renders it as HTML.
 */
export function stripHtml(html: string | null): string {
  if (!html) return ''

  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const pad = (value: number) => String(value).padStart(2, '0')

/** "GMT+08:00" -> 480, "GMT-05:30" -> -330. Minutes east of UTC. */
export function parseGmtOffset(gmtOffset: string): number {
  const match = gmtOffset.match(/GMT([+-])(\d{2}):(\d{2})/)

  if (!match) return 0

  const minutes = Number(match[2]) * 60 + Number(match[3])

  return match[1] === '-' ? -minutes : minutes
}

/**
 * Build the ISO string the API demands from what the pickers actually hold.
 *
 * The date picker holds a day, the time picker holds minutes past midnight, and
 * the timezone dropdown holds an offset. Composing them by hand - rather than
 * going through `new Date(y, m, d, h, min)` - is the point: that constructor
 * interprets the numbers in the *browser's* timezone, so picking "18:00
 * Philippine Time" on a laptop set to London would silently store 18:00 London.
 *
 * Writing the offset into the string instead means the digits mean exactly what
 * the person selected, wherever they happen to be sitting.
 */
export function toIsoWithOffset(
  day: Date,
  minutesIntoDay: number,
  gmtOffset: string,
): string {
  const offset = gmtOffset.replace('GMT', '')
  const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
  const time = `${pad(Math.floor(minutesIntoDay / 60))}:${pad(minutesIntoDay % 60)}:00`

  return `${date}T${time}${offset}`
}

/**
 * The reverse, for loading an event into the form: an instant, read as wall
 * clock in a chosen offset.
 *
 * Shifting the timestamp and then reading its UTC parts is the trick - after
 * adding the offset, "UTC hours" are the hours someone in that zone sees.
 */
export function wallClockInOffset(
  iso: string,
  gmtOffset: string,
): { day: Date; minutesIntoDay: number } {
  const shifted = new Date(new Date(iso).getTime() + parseGmtOffset(gmtOffset) * 60_000)

  return {
    day: new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
    minutesIntoDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}
