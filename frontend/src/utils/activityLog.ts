/**
 * Turning a stored log row into a sentence a person can read.
 *
 * THIS FILE IS WHY THE DATABASE STORES STRUCTURE INSTEAD OF ENGLISH.
 *
 * The API sends {action: "created", resource: "event", details: {title: "..."}}
 * and this is the single place that becomes "created Event Blockchain Meetup".
 * Storing the finished sentence instead would have frozen the wording in
 * English forever, made filtering by action a LIKE over prose, and gone stale
 * the day a role is renamed - ten thousand stored sentences do not change,
 * while one renderer changes once.
 *
 * To localise, translate the three lookup tables below. Nothing else moves.
 *
 * Pure functions: no React, no fetch.
 */

import type { ActivityLogResponse, ActivityResource } from '../types/activityLog'

/** What a resource is called in a sentence. */
const RESOURCE_LABELS: Record<ActivityResource, string> = {
  event: 'Event',
  post: 'Post',
  blog: 'Blog',
  partner: 'Partner',
  user: 'User',
}

/**
 * The icon each kind of thing gets in the feed.
 *
 * Matched to the sidebar deliberately: somebody reading the feed and somebody
 * reading the nav should recognise the same symbol as meaning the same module.
 */
const RESOURCE_ICONS: Record<ActivityResource, string> = {
  event: 'calendar_month',
  post: 'photo_library',
  blog: 'article',
  partner: 'handshake',
  user: 'person',
}

/** How each action reads. Past tense, because a log records what happened. */
const ACTION_VERBS: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  published: 'published',
  unpublished: 'unpublished',
  promoted: 'promoted',
  demoted: 'demoted',
  updated_permissions: 'updated permissions for',
}

/**
 * A sentence broken into parts rather than joined into one string.
 *
 * The parts exist so the subject can be styled - quoted, emphasised, given its
 * own colour - without the renderer having to parse a sentence back apart or
 * this file having to emit markup. A utility that returns JSX would also stop
 * being usable from a page title, an export, or a notification.
 */
export type ActivitySentence = {
  /** "created", "updated permissions for" */
  verb: string
  /** "Event", "Blog" - null when the verb already implies what was touched. */
  resourceLabel: string | null
  /** The thing's name: a title, a partner name, a person. May be null. */
  subject: string | null
  /** Trailing context: "to Official", "+2 / -1". */
  suffix: string | null
}

/** Read a string off the loose details blob, or null. */
function text(details: Record<string, unknown> | null, key: string): string | null {
  const value = details?.[key]

  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/** Read a string array off the loose details blob. */
function list(details: Record<string, unknown> | null, key: string): string[] {
  const value = details?.[key]

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** Title case a stored role so "official" reads as "Official". */
function roleLabel(role: string | null): string | null {
  if (!role) return null

  return role.charAt(0).toUpperCase() + role.slice(1)
}

/**
 * The sentence for one entry.
 *
 * Every lookup falls back to the raw stored value rather than to nothing. The
 * backend can gain an action the frontend has not heard of - they deploy
 * separately - and "archived Event" reading slightly stiffly is far better
 * than a blank row that looks like a bug.
 */
export function activitySentence(entry: ActivityLogResponse): ActivitySentence {
  const verb = ACTION_VERBS[entry.action] ?? entry.action.replace(/_/g, ' ')
  const label = RESOURCE_LABELS[entry.resource] ?? entry.resource

  // User actions name a person, not a record, so the resource label would be
  // noise: "promoted User Alice" says less than "promoted Alice".
  if (entry.resource === 'user') {
    const who = text(entry.details, 'display_name')

    if (entry.action === 'promoted' || entry.action === 'demoted') {
      return {
        verb,
        resourceLabel: null,
        subject: who,
        suffix: roleLabel(text(entry.details, 'to'))
          ? `to ${roleLabel(text(entry.details, 'to'))}`
          : null,
      }
    }

    if (entry.action === 'updated_permissions') {
      const added = list(entry.details, 'added')
      const removed = list(entry.details, 'removed')

      // Counts rather than the permission names themselves. A line reading
      // "+3" stays scannable; one listing "events.create, events.update,
      // blogs.delete" pushes every other entry off the screen. The names are
      // still in details for anyone who opens the row.
      const parts: string[] = []
      if (added.length) parts.push(`+${added.length}`)
      if (removed.length) parts.push(`-${removed.length}`)

      return {
        verb,
        resourceLabel: null,
        subject: who,
        suffix: parts.length ? parts.join(' ') : null,
      }
    }

    return { verb, resourceLabel: null, subject: who, suffix: null }
  }

  // Everything else names its record. Which key holds the name depends on the
  // module - partners have a name, the rest have a title - so both are tried
  // before giving up.
  const subject = text(entry.details, 'title') ?? text(entry.details, 'name')

  const previous = text(entry.details, 'previous_name')

  return {
    verb,
    resourceLabel: label,
    subject,
    // A rename is the one edit worth spelling out; without this it reads as an
    // ordinary update and the old name sits unread in details.
    suffix: previous ? `renamed from "${previous}"` : null,
  }
}

/** Which icon to show beside an entry. */
export function activityIcon(entry: ActivityLogResponse): string {
  return RESOURCE_ICONS[entry.resource] ?? 'bolt'
}

const MINUTE = 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24

/**
 * "3 minutes ago", "yesterday", "2 weeks ago" - in the reader's own language.
 *
 * Intl.RelativeTimeFormat does the wording and the pluralisation, so this needs
 * no table of its own and no dependency. Every browser this project targets has
 * had it for years.
 *
 * A feed is read as "what happened recently", and an absolute timestamp makes
 * the reader do the subtraction. The exact time is still available on hover -
 * see the title attribute in ActivityFeed.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)

  if (Number.isNaN(then.getTime())) return iso

  const seconds = Math.round((then.getTime() - now.getTime()) / 1000)
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (Math.abs(seconds) < MINUTE) return format.format(Math.round(seconds), 'second')
  if (Math.abs(seconds) < HOUR) return format.format(Math.round(seconds / MINUTE), 'minute')
  if (Math.abs(seconds) < DAY) return format.format(Math.round(seconds / HOUR), 'hour')
  if (Math.abs(seconds) < DAY * 7) return format.format(Math.round(seconds / DAY), 'day')
  if (Math.abs(seconds) < DAY * 30) return format.format(Math.round(seconds / (DAY * 7)), 'week')
  if (Math.abs(seconds) < DAY * 365) return format.format(Math.round(seconds / (DAY * 30)), 'month')

  return format.format(Math.round(seconds / (DAY * 365)), 'year')
}

/** The full timestamp, for the tooltip behind the relative one. */
export function exactTime(iso: string): string {
  const date = new Date(iso)

  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}
