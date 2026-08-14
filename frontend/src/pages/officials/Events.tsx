import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/Card'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import { events as initialEvents } from '../../data/mock'
import type { EventItem } from '../../data/mock'

type Tab = 'Upcoming' | 'Past'

const tabs: Tab[] = ['Upcoming', 'Past']

function groupByDate(items: EventItem[]): [string, EventItem[]][] {
  const map = new Map<string, EventItem[]>()
  for (const item of items) {
    const group = map.get(item.date)
    if (group) {
      group.push(item)
    } else {
      map.set(item.date, [item])
    }
  }
  return Array.from(map.entries())
}

export default function Events() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('Upcoming')
  const [postFilter, setPostFilter] = useState<'Live' | 'Drafts'>('Live')
  const [postOpen, setPostOpen] = useState(false)
  const [menuId, setMenuId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<EventItem[]>(initialEvents)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const filtered = items.filter((event) => {
    const inTab = tab === 'Past' ? event.status === 'Completed' : event.status !== 'Completed'
    if (!inTab) return false
    const isDraft = event.status === 'Draft' || event.status === 'Review'
    if (postFilter === 'Live' ? isDraft : !isDraft) return false
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return [event.name, event.location, event.description]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })
  const groups = groupByDate(filtered)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Manage Events"
        subtitle="View, edit, and organize upcoming events."
        actionLabel="Add Event"
        onAction={() => navigate('/events/new')}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events, locations..."
            className="h-10 w-full rounded-lg border border-outline bg-surface-lowest pl-10 pr-4 text-sm text-on-surface placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </label>
        <div className="flex h-10 items-center rounded-lg bg-surface-low p-0.5">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`h-full rounded-md px-4 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-surface-lowest text-on-surface shadow-float'
                  : 'text-muted hover:text-on-surface'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPostOpen((open) => !open)}
            className="flex h-10 items-center gap-2 rounded-lg bg-surface-low px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            {postFilter}
            <Icon name={postOpen ? 'expand_less' : 'expand_more'} className="text-[18px]" />
          </button>
          {postOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
              {(['Live', 'Drafts'] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setPostFilter(label)
                    setPostOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-low ${
                    postFilter === label ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {label}
                  {postFilter === label && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {tab === 'Past' ? 'No past events.' : 'No upcoming events.'}
        </p>
      ) : (
        <div className="flex flex-col">
          {groups.map(([date, groupEvents]) => (
            <div
              key={date}
              className="relative grid grid-cols-[140px_1fr] gap-x-10 pb-8 last:pb-0"
            >
              <div
                aria-hidden="true"
                className="absolute bottom-0 left-[140px] top-0 border-l border-dashed border-outline"
              />
              <span
                aria-hidden="true"
                className="absolute left-[140px] top-2.5 h-2 w-2 -translate-x-1/2 rounded-full bg-outline-strong"
              />

              <div className="pt-1">
                <p className="text-base font-semibold text-on-surface">{date}</p>
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                {groupEvents.map((event) => (
                  <Card key={event.id} hover className="group relative flex items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-5">
                      <p className="text-sm text-muted">{event.time}</p>
                      <h2 className="text-lg font-semibold leading-snug text-on-surface">
                        {event.name}
                      </h2>
                      <p className="truncate text-sm text-on-surface-variant">
                        {event.description}
                      </p>
                      <p className="flex items-center gap-2 text-sm text-on-surface-variant">
                        <Icon name="location_on" className="text-[18px]" />
                        {event.location}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={event.status} />
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            event.status === 'Draft' || event.status === 'Review'
                              ? 'bg-surface-low text-on-surface-variant'
                              : 'bg-success-bg text-success'
                          }`}
                        >
                          {event.status === 'Draft' || event.status === 'Review'
                            ? 'Draft'
                            : 'Live'}
                        </span>
                        <div
                          className={`relative transition-opacity group-hover:opacity-100 ${
                            menuId === event.id ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <button
                            type="button"
                            aria-label={`Options for ${event.name}`}
                            onClick={() => setMenuId(menuId === event.id ? null : event.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                          >
                            <Icon name="more_horiz" className="text-[20px]" />
                          </button>
                          {menuId === event.id && (
                            <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuId(null)
                                  navigate(`/events/edit/${event.id}`)
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                              >
                                <Icon name="edit" className="text-[16px]" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuId(null)
                                  setDeleteId(event.id)
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                              >
                                <Icon name="delete" className="text-[16px]" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="m-4 flex h-28 w-28 shrink-0 items-center justify-center rounded-lg bg-surface-container text-muted">
                      <Icon name="image" className="text-[32px]" />
                    </div>

                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete event?"
        message="This event will be permanently removed."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          setItems((current) => current.filter((item) => item.id !== deleteId))
          setDeleteId(null)
        }}
      />
    </div>
  )
}
