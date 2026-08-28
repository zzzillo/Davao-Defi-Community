import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/react'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import EventStatusBadge from '../../components/events/EventStatusBadge'
import ActivityFeed from '../../components/activity/ActivityFeed'
import { useActivityLogs } from '../../hooks/useActivityLogs'
import { useBlogs } from '../../hooks/useBlogs'
import { useEvents } from '../../hooks/useEvents'
import { usePartners } from '../../hooks/usePartners'
import { usePosts } from '../../hooks/usePosts'
import { formatEventDay, formatEventTimeRange } from '../../utils/event'

const UPCOMING_PANEL_SIZE = 5
const ACTIVITY_PANEL_SIZE = 5

type Counter = {
  label: string
  /** Null while loading or unavailable - rendered as a dash, never as zero. */
  value: number | null
  icon: string
  to: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useUser()

  // Five deliberately tiny requests. Each counter needs a total, not a list,
  // and the API returns the total alongside any page - so limit 1 fetches one
  // row and answers "how many are there" for free.
  const events = useEvents({ include_drafts: true, limit: 1 })
  const posts = usePosts({ include_drafts: true, limit: 1 })
  const blogs = useBlogs({ include_drafts: true, limit: 1 })

  // No include_drafts, because partners have none. The other three ask for it
  // so the number counts what an official can see rather than only what is
  // public; here those are the same thing.
  const partners = usePartners({ limit: 1 })

  // Five rows, which is what the panel shows. Unlike the counters above
  // this one wants the rows themselves, so limit is the page size rather
  // than 1.
  const activity = useActivityLogs({ limit: ACTIVITY_PANEL_SIZE })

  // This one earns its rows: it fills the panel below as well as the counter.
  // upcoming=true is a server-side filter and returns soonest first, so no
  // sorting happens here.
  const upcoming = useEvents({ upcoming: true, limit: UPCOMING_PANEL_SIZE })

  const counters: Counter[] = [
    {
      label: 'Upcoming',
      value: upcoming.error ? null : upcoming.total,
      icon: 'schedule',
      to: '/admin/events',
    },
    {
      label: 'Events',
      value: events.error ? null : events.total,
      icon: 'calendar_month',
      to: '/admin/events',
    },
    {
      label: 'Posts',
      value: posts.error ? null : posts.total,
      icon: 'photo_library',
      to: '/admin/posts',
    },
    {
      label: 'Blogs',
      value: blogs.error ? null : blogs.total,
      icon: 'article',
      to: '/admin/blogs',
    },
    {
      label: 'Partners',
      value: partners.error ? null : partners.total,
      // handshake, matching the sidebar. An official sees both at once, and a
      // counter with a different icon than the nav item it links to reads as
      // two different things. PartnerCard's empty state keeps `domain` - a
      // building is the right placeholder for an organization with no logo.
      icon: 'handshake',
      to: '/admin/partners',
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Hello there, ${user?.firstName ?? 'there'}`}
        subtitle="Welcome back. Here's what's happening today."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {counters.map((counter) => (
          <button
            key={counter.label}
            type="button"
            onClick={() => navigate(counter.to)}
            className="text-left"
          >
            <Card hover className="p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {counter.label}
                </p>
                <span className="flex items-center justify-center text-on-surface">
                  <Icon name={counter.icon} className="text-[22px]" />
                </span>
              </div>
              <p className="mt-1 text-3xl font-bold tracking-tight text-on-surface">
                {/*
                  A dash rather than 0 when the number could not be read. Zero
                  is a fact - "there are none" - and showing it for "we do not
                  know" is a quiet lie the reader cannot detect.
                */}
                {counter.value ?? '—'}
              </p>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="flex h-8 items-center text-lg font-semibold text-on-surface">
              Upcoming Events
            </h2>
            <button
              type="button"
              onClick={() => navigate('/admin/events')}
              className="flex h-8 items-center gap-1 text-sm font-semibold text-on-surface transition-opacity hover:opacity-70"
            >
              View all
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>

          {upcoming.loading ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Loading events...</p>
          ) : upcoming.error ? (
            <p className="px-5 py-10 text-center text-sm text-error">
              {upcoming.error.message}
            </p>
          ) : upcoming.events.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No upcoming events.</p>
          ) : (
            <div className="flex flex-col">
              {upcoming.events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => navigate(`/admin/events/edit/${event.id}`)}
                  className="flex flex-col gap-1 border-b border-outline px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-surface-low"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      {formatEventDay(event.start_datetime)} · {formatEventTimeRange(event)}
                    </p>
                    <EventStatusBadge event={event} />
                  </div>
                  <h3 className="text-base font-semibold text-on-surface">{event.title}</h3>
                  {event.location && (
                    <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                      <Icon name="location_on" className="text-[16px]" />
                      {event.location}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="flex h-8 items-center text-lg font-semibold text-on-surface">
              Recent Activity
            </h2>
          </div>
          <div className="flex flex-1 flex-col">
            {activity.loading ? (
              <p className="px-5 py-10 text-center text-sm text-muted">Loading activity...</p>
            ) : activity.error ? (
              /*
                An official without activity_logs.read gets a 403 here. Saying
                so beats an empty panel that looks like nothing has happened.
              */
              <p className="px-5 py-10 text-center text-sm text-muted">
                {activity.error.status === 403
                  ? 'You do not have access to the activity log.'
                  : activity.error.message}
              </p>
            ) : activity.entries.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">
                No activity recorded yet.
              </p>
            ) : (
              /* The same component the Activity page uses, so the panel is a
                 true preview rather than a second wording of the same rows. */
              <ActivityFeed entries={activity.entries} compact />
            )}
          </div>
          <div className="px-5 py-4">
            <button
              type="button"
              onClick={() => navigate('/admin/activity')}
              className="flex items-center gap-1 text-sm font-semibold text-on-surface transition-opacity hover:opacity-70"
            >
              View activity
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
