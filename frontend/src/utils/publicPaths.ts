import { slugify } from './blog'

/**
 * Public addresses for event galleries and RSVP pages.
 *
 * The id still identifies the page; the title slug after it is for people and
 * search engines: /rsvp/<id>/defi-meetup-at-ateneo. The slug is not stored -
 * it is derived from the title with the same slugify the backend uses
 * (app/services/slug_service.py), so the sitemap lists the same address.
 * A link with a missing or outdated slug still opens the page and is
 * redirected to the current one, so renaming an event never breaks a link.
 */

type Titled = { id: string; title?: string | null }

function titledPath(prefix: string, item: Titled): string {
  const base = `${prefix}/${encodeURIComponent(item.id)}`
  const slug = item.title ? slugify(item.title) : ''
  return slug ? `${base}/${slug}` : base
}

/** An event's photo gallery (a "post" in the API). */
export function eventGalleryPath(post: Titled): string {
  return titledPath('/events', post)
}

/** An upcoming event's RSVP page (an "event" in the API). */
export function rsvpPath(event: Titled): string {
  return titledPath('/rsvp', event)
}
