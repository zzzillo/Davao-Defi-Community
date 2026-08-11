import Card from '../components/Card'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { blogs, currentUser, events, stats } from '../data/mock'

export default function Dashboard() {
  const recentEvents = events.slice(0, 4)
  const recentBlogs = blogs.slice(0, 3)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Hello there, ${currentUser.name}`}
        subtitle="Welcome back. Here's what's happening today."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                {stat.label}
              </p>
              <span className="flex items-center justify-center text-on-surface">
                <Icon name={stat.icon} className="text-[22px]" />
              </span>
            </div>
            <p className="mt-1 text-3xl font-bold tracking-tight text-on-surface">{stat.value}</p>
            <p className="mt-2 flex items-center gap-1 text-sm text-on-surface-variant">
              {stat.trend && (
                <span
                  className={`flex items-center gap-0.5 font-semibold ${
                    stat.trendUp ? 'text-success' : 'text-muted'
                  }`}
                >
                  {stat.trendUp && <Icon name="trending_up" className="text-[18px]" />}
                  {stat.trend}
                </span>
              )}
              {stat.note}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="text-lg font-semibold text-on-surface">Recent Events</h2>
            <button
              type="button"
              className="flex h-8 items-center gap-1 text-sm font-semibold text-on-surface transition-opacity hover:opacity-70"
            >
              View All
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline bg-surface text-xs font-semibold uppercase tracking-wider text-muted">
                <th className="px-5 py-2.5 font-semibold">Event Name</th>
                <th className="px-5 py-2.5 font-semibold">Date</th>
                <th className="px-5 py-2.5 font-semibold">Location</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-5 py-3 font-medium text-on-surface">{event.name}</td>
                  <td className="px-5 py-3 text-on-surface-variant">{event.date}</td>
                  <td className="px-5 py-3 text-on-surface-variant">{event.location}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={event.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="flex h-8 items-center text-lg font-semibold text-on-surface">
              Recent Blogs
            </h2>
          </div>
          <div className="flex flex-col gap-4 px-5 py-4">
            {recentBlogs.map((blog) => (
              <div key={blog.id} className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-low text-muted">
                  <Icon name="image" className="text-[22px]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-on-surface">{blog.title}</p>
                  <p className="text-sm text-on-surface-variant">By {blog.author}</p>
                  <p className="text-xs text-muted">{blog.date}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5">
            <button
              type="button"
              className="w-full rounded-lg border border-outline bg-surface-lowest py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
            >
              View All Posts
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
