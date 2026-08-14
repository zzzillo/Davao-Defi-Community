import { useNavigate } from 'react-router-dom'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import { actionsLog, blogs, currentUser, events, posts } from '../../data/mock'

export default function Dashboard() {
  const navigate = useNavigate()

  const upcomingEvents = events
    .filter((event) => event.status === 'Upcoming' || event.status === 'Ongoing')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const counters = [
    { label: 'Upcoming', value: upcomingEvents.length, icon: 'schedule', to: '/events' },
    { label: 'Events', value: events.length, icon: 'calendar_month', to: '/events' },
    { label: 'Posts', value: posts.length, icon: 'photo_library', to: '/posts' },
    {
      label: 'Published Blogs',
      value: blogs.filter((blog) => blog.status === 'Published').length,
      icon: 'article',
      to: '/blogs',
    },
  ]

  const recentActivity = actionsLog.slice(0, 5)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Hello there, ${currentUser.name}`}
        subtitle="Welcome back. Here's what's happening today."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                {counter.value}
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
              onClick={() => navigate('/events')}
              className="flex h-8 items-center gap-1 text-sm font-semibold text-on-surface transition-opacity hover:opacity-70"
            >
              View all
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No upcoming events.</p>
          ) : (
            <div className="flex flex-col">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-1 border-b border-outline px-5 py-4 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted">
                      {event.date} · {event.time}
                    </p>
                    <StatusBadge status={event.status} />
                  </div>
                  <h3 className="text-base font-semibold text-on-surface">{event.name}</h3>
                  <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                    <Icon name="location_on" className="text-[16px]" />
                    {event.location}
                  </p>
                </div>
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
            {recentActivity.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-1 border-b border-outline px-5 py-3 last:border-b-0"
              >
                <p className="text-sm text-on-surface">
                  <span className="font-semibold">{entry.user.split(' ')[0]}</span>{' '}
                  <span className="text-on-surface-variant">{entry.action}</span>
                </p>
                <p className="flex items-center gap-2 text-xs text-muted">
                  <span className="inline-flex items-center rounded-full bg-surface-low px-2 py-0.5 font-semibold text-on-surface-variant">
                    {entry.module}
                  </span>
                  {entry.date}
                </p>
              </div>
            ))}
          </div>
          <div className="px-5 py-4">
            <button
              type="button"
              onClick={() => navigate('/activity')}
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
