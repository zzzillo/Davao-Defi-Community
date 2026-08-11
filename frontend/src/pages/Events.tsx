import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { events } from '../data/mock'
import type { EventItem } from '../data/mock'

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

  const filtered = events.filter((event) =>
    tab === 'Past' ? event.status === 'Completed' : event.status !== 'Completed',
  )
  const groups = groupByDate(filtered)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Manage Events"
        subtitle="View, edit, and organize upcoming events."
        actionLabel="Add Event"
        onAction={() => navigate('/events/new')}
      />

      <div className="flex justify-end">
        <div className="flex rounded-lg bg-surface-low p-0.5">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-surface-lowest text-on-surface shadow-float'
                  : 'text-muted hover:text-on-surface'
              }`}
            >
              {t}
            </button>
          ))}
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
                      <div className="mt-1">
                        <StatusBadge status={event.status} />
                      </div>
                    </div>

                    <div className="m-4 flex h-28 w-28 shrink-0 items-center justify-center rounded-lg bg-surface-container text-muted">
                      <Icon name="image" className="text-[32px]" />
                    </div>

                    <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label={`Edit ${event.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-lowest text-on-surface shadow-float transition-colors hover:bg-surface-low"
                      >
                        <Icon name="edit" className="text-[18px]" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${event.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-lowest text-on-surface shadow-float transition-colors hover:bg-surface-low"
                      >
                        <Icon name="delete" className="text-[18px]" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
