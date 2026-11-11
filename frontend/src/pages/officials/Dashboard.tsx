import { useNavigate } from 'react-router-dom'
import { useAppAuth } from '../../auth/useAppAuth'
import ActivityFeed from '../../components/activity/ActivityFeed'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { useDashboard } from '../../hooks/useDashboard'
import { useEvents } from '../../hooks/useEvents'
import { usePosts } from '../../hooks/usePosts'
import { useBlogs } from '../../hooks/useBlogs'
import type { AdminDashboard } from '../../types/dashboard'
import { ApiError } from '../../services/api'
import { useToastError } from '../../hooks/useToast'
import { formatEventDay, formatEventTimeRange } from '../../utils/event'
import { formatPostDate, postDisplayTitle } from '../../utils/post'
import { blogDateLabel } from '../../utils/blog'

type DashboardCard = {
  key: keyof NonNullable<AdminDashboard['totals']>
  label: string
  icon: string
  to: string
}

const cards: DashboardCard[] = [
  { key: 'blogs', label: 'Blogs', icon: 'article', to: '/admin/blogs' },
  { key: 'events', label: 'Events', icon: 'calendar_month', to: '/admin/events' },
  { key: 'posts', label: 'Recaps', icon: 'photo_library', to: '/admin/posts' },
  { key: 'partners', label: 'Partners', icon: 'handshake', to: '/admin/partners' },
  { key: 'users', label: 'Users', icon: 'group', to: '/admin/users' },
]

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Could not reach the server. Check your connection and try again.'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { appUser } = useAppAuth()
  const { dashboard: data, loading, refreshing, error: loadError, reload } = useDashboard()
  const { events, loading: eventsLoading, error: eventsError, reload: reloadEvents } = useEvents({
    upcoming: true,
    limit: 5,
  })
  const { posts, loading: postsLoading, error: postsError, reload: reloadPosts } = usePosts({ limit: 5 })
  const { blogs, loading: blogsLoading, error: blogsError, reload: reloadBlogs } = useBlogs({ limit: 5 })
  const error = loadError ? loadErrorMessage(loadError) : null
  useToastError(error)
  useToastError(eventsError)
  useToastError(postsError)
  useToastError(blogsError)

  const visibleCards = cards.filter((card) => data?.totals[card.key] !== undefined)
  const recentWork = data?.recent_work ?? []

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Hello there, ${appUser?.display_name || 'there'}`}
        subtitle="Welcome back. Here's what's happening today."
      />

      {error && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={reload}
            className="rounded-md px-3 py-1.5 font-semibold text-on-surface transition-colors hover:bg-surface-low"
          >
            Retry loading dashboard
          </button>
        </div>
      )}

      <div className="grid items-stretch grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {(data ? visibleCards : cards.slice(0, 1)).map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => navigate(card.to)}
            className="h-full text-left"
            disabled={loading && !data}
          >
            <Card hover className="h-full min-h-[132px] p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{card.label}</p>
                <span className="flex items-center justify-center text-on-surface">
                  <Icon name={card.icon} className="text-[22px]" />
                </span>
              </div>
              <p className="mt-1 text-3xl font-bold tracking-tight text-on-surface">
                {loading && !data ? '—' : data?.totals[card.key] ?? '—'}
              </p>
              {card.key === 'blogs' && data?.totals.blog_drafts !== undefined && (
                <p className="mt-1 text-xs text-muted">{data.totals.blog_drafts} drafts</p>
              )}
              {card.key === 'events' && data?.totals.event_drafts !== undefined && (
                <p className="mt-1 text-xs text-muted">{data.totals.event_drafts} drafts</p>
              )}
              {card.key === 'posts' && data?.totals.post_drafts !== undefined && (
                <p className="mt-1 text-xs text-muted">{data.totals.post_drafts} drafts</p>
              )}
            </Card>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <Card className="flex h-[400px] min-h-0 flex-col xl:col-span-2">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="flex h-8 items-center text-lg font-semibold text-on-surface">Upcoming Events</h2>
            <button
              type="button"
              onClick={() => navigate('/admin/events')}
              className="flex items-center gap-1 text-sm font-semibold text-on-surface transition-opacity hover:opacity-70"
            >
              All events
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {eventsError && (
              <div className="px-5 pt-3 text-right">
                <button type="button" onClick={reloadEvents} className="text-sm font-semibold text-on-surface underline underline-offset-2">
                  Retry loading events
                </button>
              </div>
            )}
            {eventsLoading && events.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">Loading upcoming events...</p>
            ) : events.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">No upcoming events.</p>
            ) : (
              <div className="divide-y divide-outline">
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => navigate(`/admin/events/edit/${event.id}`)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-low"
                  >
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-low text-center">
                      <span className="text-[10px] font-semibold uppercase text-muted">
                        {new Date(event.start_datetime).toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold leading-5 text-on-surface">
                        {new Date(event.start_datetime).getDate()}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-on-surface">{event.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {formatEventDay(event.start_datetime)} · {formatEventTimeRange(event)}
                        {event.location ? ` · ${event.location}` : ''}
                      </span>
                    </span>
                    <Icon name="chevron_right" className="shrink-0 text-[20px] text-muted" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="flex h-[400px] min-h-0 min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="flex h-8 items-center text-base font-semibold text-on-surface">Recent Activity</h2>
            {refreshing && <span role="status" className="text-xs text-muted">Refreshing…</span>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-xs text-muted">Loading activity...</p>
            ) : error ? (
              <p className="px-4 py-8 text-center text-xs text-muted">Activity is unavailable until the dashboard loads.</p>
            ) : recentWork.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">No activity recorded yet.</p>
            ) : (
              <ActivityFeed entries={recentWork as never} compact />
            )}
          </div>
          {data?.totals.activity !== undefined && (
            <div className="mt-auto flex items-center justify-between border-t border-outline px-4 py-3">
              <span className="text-xs text-muted">{data.totals.activity} total</span>
              <button
                type="button"
                onClick={() => navigate('/admin/activity')}
                className="flex items-center gap-1 text-xs font-semibold text-on-surface transition-opacity hover:opacity-70"
              >
                View activity
                <Icon name="arrow_forward" className="text-[18px]" />
              </button>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
        <Card className="flex h-[400px] min-h-0 min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="flex h-8 items-center text-lg font-semibold text-on-surface">Recaps</h2>
            <button
              type="button"
              onClick={() => navigate('/admin/posts')}
              className="flex items-center gap-1 text-sm font-semibold text-on-surface transition-opacity hover:opacity-70"
            >
              All recaps
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
          {postsError && <div className="px-5 pt-3 text-right"><button type="button" onClick={reloadPosts} className="text-sm font-semibold text-on-surface underline underline-offset-2">Retry loading recaps</button></div>}
          {postsLoading && posts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Loading recaps...</p>
          ) : posts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No recaps yet.</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-outline">
              {posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => navigate(`/admin/posts/edit/${post.id}`)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-low"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-low text-on-surface-variant">
                    <Icon name="photo_library" className="text-[20px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-on-surface">{postDisplayTitle(post)}</span>
                    <span className="mt-1 block truncate text-xs text-muted">{formatPostDate(post.post_date)}{post.location ? ` · ${post.location}` : ''}</span>
                  </span>
                  <Icon name="chevron_right" className="shrink-0 text-[20px] text-muted" />
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex h-[400px] min-h-0 min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-outline px-5 py-4">
            <h2 className="flex h-8 items-center text-lg font-semibold text-on-surface">Blogs</h2>
            <button
              type="button"
              onClick={() => navigate('/admin/blogs')}
              className="flex items-center gap-1 text-sm font-semibold text-on-surface transition-opacity hover:opacity-70"
            >
              All blogs
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
          {blogsError && <div className="px-5 pt-3 text-right"><button type="button" onClick={reloadBlogs} className="text-sm font-semibold text-on-surface underline underline-offset-2">Retry loading blogs</button></div>}
          {blogsLoading && blogs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Loading blogs...</p>
          ) : blogs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No blogs yet.</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-outline">
              {blogs.map((blog) => (
                <button
                  key={blog.id}
                  type="button"
                  onClick={() => navigate(`/admin/blogs/edit/${blog.id}`)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-low"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-low text-on-surface-variant">
                    <Icon name="article" className="text-[20px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-on-surface">{blog.title}</span>
                    <span className="mt-1 block truncate text-xs text-muted">{blogDateLabel(blog)}</span>
                  </span>
                  <Icon name="chevron_right" className="shrink-0 text-[20px] text-muted" />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
