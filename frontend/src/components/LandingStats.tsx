import { useEvents } from '../hooks/useEvents'
import { usePartners } from '../hooks/usePartners'
import { useContributors } from '../hooks/useContributors'

type Metric = {
  value: number
  loading: boolean
  unavailable: boolean
  label: string
}

export default function LandingStats({ compact = false }: { compact?: boolean }) {
  // The public list responses include totals, so these are live counts of
  // published events and directory-visible people and partners.
  const events = useEvents({ limit: 1 })
  const contributors = useContributors({ limit: 1 })
  const partners = usePartners({ limit: 1 })

  const stats: Metric[] = [
    { value: events.total, loading: events.loading, unavailable: Boolean(events.error), label: 'Events' },
    { value: contributors.total, loading: contributors.loading, unavailable: Boolean(contributors.error), label: 'Contributors' },
    { value: partners.total, loading: partners.loading, unavailable: Boolean(partners.error), label: 'Partners' },
  ]

  const spacing = compact
    ? 'w-full py-0'
    : 'w-full px-6 py-5 sm:px-10 sm:py-14 lg:px-16'

  return (
    <section aria-label="Community statistics" className={spacing}>
      <div className="mx-auto w-full max-w-[1160px]">
        <div className="grid w-full grid-cols-3 border-b border-gray-200 pb-4 dark:border-[#262626] sm:pb-6 lg:pb-12">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              data-scroll-reveal
              className="scroll-reveal flex min-w-0 flex-col items-center justify-center gap-0 px-1 py-2 text-center sm:gap-1 sm:px-4 sm:py-0"
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <span className="text-3xl font-semibold tracking-tight text-black dark:text-[#f5f5f5] sm:text-5xl lg:text-6xl">
                {stat.loading ? '…' : stat.unavailable ? '—' : stat.value.toLocaleString()}
              </span>
              <span className="text-[11px] leading-tight text-gray-500 dark:text-[#8a8a8a] sm:text-xl">
                {stat.label}
                {stat.unavailable && <span className="sr-only"> count unavailable</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
