const stats = [
  { value: '20+', label: 'Events' },
  { value: '100+', label: 'Contributors' },
  { value: '12', label: 'Partners' },
]

export default function LandingStats({ compact = false }: { compact?: boolean }) {
  const spacing = compact
    ? 'w-full py-2 sm:py-3'
    : 'w-full px-6 py-5 sm:px-10 sm:py-14 lg:px-16'

  return (
    <section
      aria-label="Community statistics"
      className={spacing}
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <div className="grid w-full grid-cols-3 border-b border-gray-200 pb-12">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              data-scroll-reveal
              className="scroll-reveal flex min-w-0 flex-col items-center justify-center gap-0 px-1 py-2 text-center sm:gap-1 sm:px-4 sm:py-0"
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <span className="text-3xl font-semibold tracking-tight text-black sm:text-5xl lg:text-6xl">
                {stat.value}
              </span>
              <span className="text-[11px] leading-tight text-gray-500 sm:text-xl">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
