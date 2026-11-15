import type { ReactNode } from 'react'

type SkeletonProps = { className?: string }

/** A theme-aware placeholder block with a shimmer that disables for reduced motion. */
export function SkeletonBlock({ className = '' }: SkeletonProps) {
  return <span aria-hidden="true" className={`skeleton-shimmer block rounded-md bg-surface-high ${className}`} />
}

function SkeletonStatus({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <div role="status" aria-label={label} className={className}>{children}</div>
}

export function SkeletonGrid({
  label,
  count = 6,
  kind = 'event',
  className = '',
}: {
  label: string
  count?: number
  kind?: 'event' | 'contributor' | 'partner'
  className?: string
}) {
  const items = Array.from({ length: count }, (_, index) => index)
  const columns = kind === 'partner'
    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
    : kind === 'contributor'
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <SkeletonStatus label={label} className={`grid ${columns} gap-5 ${className}`}>
      {items.map((item) => (
        <div key={item} aria-hidden="true" className="overflow-hidden rounded-xl border border-outline bg-surface-lowest">
          <SkeletonBlock className={kind === 'contributor' ? 'aspect-square rounded-none' : kind === 'partner' ? 'aspect-[4/3] rounded-none' : 'aspect-[4/3] rounded-none'} />
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            <SkeletonBlock className="h-5 w-3/4" />
            <SkeletonBlock className="h-3.5 w-1/2" />
            {kind !== 'partner' && <><SkeletonBlock className="mt-1 h-3.5 w-full" /><SkeletonBlock className="h-3.5 w-5/6" /></>}
          </div>
        </div>
      ))}
    </SkeletonStatus>
  )
}

export function SkeletonRows({ label, count = 4, className = '' }: { label: string; count?: number; className?: string }) {
  return (
    <SkeletonStatus label={label} className={`divide-y divide-outline ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} aria-hidden="true" className="flex items-center gap-4 py-4">
          <SkeletonBlock className="h-12 w-12 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <SkeletonBlock className="h-4 w-2/3" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
          <SkeletonBlock className="h-5 w-5 shrink-0 rounded-full" />
        </div>
      ))}
    </SkeletonStatus>
  )
}

export function SkeletonArticleRows({ label, count = 4, className = '' }: { label: string; count?: number; className?: string }) {
  return (
    <SkeletonStatus label={label} className={`flex flex-col ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <article key={index} aria-hidden="true" className="grid gap-4 border-b border-outline py-5 sm:grid-cols-[minmax(0,220px)_1fr] sm:gap-6">
          <SkeletonBlock className="aspect-[4/3] w-full" />
          <div className="flex flex-col items-start gap-3 py-1 sm:py-2">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-6 w-4/5" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
        </article>
      ))}
    </SkeletonStatus>
  )
}

export function SkeletonDetail({ label, kind = 'article' }: { label: string; kind?: 'article' | 'event' | 'contributor' }) {
  return (
    <SkeletonStatus label={label} className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <SkeletonBlock className="h-4 w-36" />
      {kind === 'article' ? (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <SkeletonBlock className="aspect-[16/8] w-full rounded-xl" />
          <SkeletonBlock className="h-9 w-5/6" />
          <div className="flex gap-4"><SkeletonBlock className="h-4 w-28" /><SkeletonBlock className="h-4 w-32" /></div>
          <div className="flex flex-col gap-3 pt-2"><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-11/12" /><SkeletonBlock className="h-4 w-4/5" /><SkeletonBlock className="mt-3 h-6 w-2/3" /><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-5/6" /></div>
        </div>
      ) : (
        <div className="grid items-start gap-6 sm:gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <SkeletonBlock className={`${kind === 'contributor' ? 'aspect-square' : 'aspect-square'} w-full rounded-xl`} />
          <div className="flex flex-col gap-4 py-1 sm:py-3">
            <SkeletonBlock className="h-8 w-4/5" />
            <SkeletonBlock className="h-4 w-2/3" />
            <SkeletonBlock className="h-4 w-1/2" />
            <div className="flex flex-col gap-3 pt-2"><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-5/6" /><SkeletonBlock className="h-4 w-3/4" /></div>
            <SkeletonBlock className="mt-3 h-10 w-48 rounded-full" />
          </div>
        </div>
      )}
    </SkeletonStatus>
  )
}

export function SkeletonForm({ label }: { label: string }) {
  return (
    <SkeletonStatus label={label} className="flex flex-col gap-5">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-4 w-80 max-w-full" />
      <div aria-hidden="true" className="flex flex-col gap-5 rounded-xl border border-outline bg-surface-lowest p-4 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((field) => <div key={field} className="flex flex-col gap-2"><SkeletonBlock className="h-3.5 w-28" /><SkeletonBlock className="h-10 w-full rounded-lg" /></div>)}
        </div>
        <div className="flex flex-col gap-2"><SkeletonBlock className="h-3.5 w-32" /><SkeletonBlock className="h-32 w-full rounded-lg" /></div>
        <div className="flex justify-end gap-3"><SkeletonBlock className="h-10 w-24 rounded-lg" /><SkeletonBlock className="h-10 w-32 rounded-lg" /></div>
      </div>
    </SkeletonStatus>
  )
}

export function SkeletonTableRows({ label, columns = 6, rows = 5 }: { label: string; columns?: number; rows?: number }) {
  return (
    <SkeletonStatus label={label} className="overflow-hidden rounded-xl border border-outline bg-surface-lowest">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} aria-hidden="true" className="flex items-center gap-4 border-b border-outline px-5 py-4 last:border-0">
          {Array.from({ length: columns }, (_, column) => <SkeletonBlock key={column} className={`h-4 ${column === 0 ? 'w-36' : 'hidden w-24 sm:block'} ${column === columns - 1 ? 'ml-auto w-16' : ''}`} />)}
        </div>
      ))}
    </SkeletonStatus>
  )
}

export function SkeletonTableBodyRows({ columns = 7, rows = 5 }: { columns?: number; rows?: number }) {
  return <>{Array.from({ length: rows }, (_, row) => <tr key={row} aria-hidden="true" className="border-b border-outline last:border-0">{Array.from({ length: columns }, (_, column) => <td key={column} className="px-4 py-4"><SkeletonBlock className={`h-4 ${column === 0 ? 'w-10' : column === 1 ? 'w-36' : 'w-20'}`} /></td>)}</tr>)}</>
}

export function SkeletonDashboard({ label }: { label: string }) {
  return (
    <SkeletonStatus label={label} className="flex flex-col gap-5">
      <div aria-hidden="true" className="flex flex-col gap-2"><SkeletonBlock className="h-8 w-56" /><SkeletonBlock className="h-4 w-80 max-w-full" /></div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} aria-hidden="true" className="flex min-h-[108px] flex-col gap-4 rounded-xl border border-outline bg-surface-lowest p-4 sm:min-h-[132px]"><SkeletonBlock className="h-3.5 w-1/2" /><SkeletonBlock className="h-8 w-1/3" /></div>)}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} aria-hidden="true" className={`h-[400px] rounded-xl border border-outline bg-surface-lowest ${item === 0 ? 'xl:col-span-2' : ''}`}><div className="border-b border-outline px-5 py-4"><SkeletonBlock className="h-6 w-40" /></div><div className="divide-y divide-outline px-5">{[0, 1, 2, 3].map((row) => <div key={row} className="flex items-center gap-4 py-4"><SkeletonBlock className="h-12 w-12 shrink-0 rounded-lg" /><div className="flex flex-1 flex-col gap-2"><SkeletonBlock className="h-4 w-2/3" /><SkeletonBlock className="h-3 w-1/2" /></div></div>)}</div></div>)}
      </div>
    </SkeletonStatus>
  )
}

export function SkeletonSignIn({ label }: { label: string }) {
  return (
    <SkeletonStatus label={label} className="flex w-full flex-col gap-5 pt-2">
      <div aria-hidden="true" className="flex flex-col items-center gap-2 pb-1">
        <SkeletonBlock className="h-6 w-40" />
        <SkeletonBlock className="h-4 w-56 max-w-full" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><SkeletonBlock className="h-3.5 w-20" /><SkeletonBlock className="h-10 w-full rounded-lg" /></div>
        <SkeletonBlock className="h-10 w-full rounded-lg" />
      </div>
      <div aria-hidden="true" className="flex items-center gap-3"><SkeletonBlock className="h-px flex-1" /><SkeletonBlock className="h-3 w-8" /><SkeletonBlock className="h-px flex-1" /></div>
      <SkeletonBlock className="mx-auto h-4 w-48 max-w-full" />
    </SkeletonStatus>
  )
}

export function SkeletonResetPassword({ label }: { label: string }) {
  return (
    <SkeletonStatus label={label} className="w-[calc(100%+1.125rem)]">
      <div aria-hidden="true" className="flex flex-col">
        <SkeletonBlock className="mx-auto h-5 w-44" />
        <SkeletonBlock className="mx-auto mt-3 h-4 w-64 max-w-full" />
        <div className="mt-8 flex flex-col gap-6">
          <div className="flex flex-col gap-2"><SkeletonBlock className="h-4 w-28" /><SkeletonBlock className="h-[34px] w-full rounded-xl" /></div>
          <SkeletonBlock className="h-[34px] w-full rounded-xl" />
        </div>
        <SkeletonBlock className="mx-auto mt-8 h-3 w-32" />
        <SkeletonBlock className="mx-auto mt-5 h-4 w-28" />
      </div>
    </SkeletonStatus>
  )
}

export function ProtectedRouteSkeleton() {
  return (
    <SkeletonStatus label="Loading your workspace" className="flex min-h-dvh bg-surface">
      <aside aria-hidden="true" className="hidden w-64 shrink-0 border-r border-outline bg-surface-lowest p-5 lg:block">
        <SkeletonBlock className="mb-10 h-8 w-36" />
        <div className="flex flex-col gap-3">{[0, 1, 2, 3, 4, 5].map((item) => <SkeletonBlock key={item} className="h-10 w-full rounded-lg" />)}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div aria-hidden="true" className="flex h-14 items-center justify-between border-b border-outline px-5"><SkeletonBlock className="h-8 w-8 rounded-full" /><SkeletonBlock className="h-8 w-32 rounded-full" /></div>
        <div aria-hidden="true" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-12">
          <SkeletonBlock className="h-8 w-52" />
          <SkeletonBlock className="h-4 w-80 max-w-full" />
          <div aria-hidden="true" className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="flex min-h-[108px] flex-col gap-4 rounded-xl border border-outline bg-surface-lowest p-4"><SkeletonBlock className="h-3.5 w-1/2" /><SkeletonBlock className="h-8 w-1/3" /></div>)}</div>
            <div className="grid gap-4 xl:grid-cols-2">{[0, 1].map((item) => <div key={item} className="flex h-64 flex-col gap-5 rounded-xl border border-outline bg-surface-lowest p-5"><SkeletonBlock className="h-6 w-40" />{[0, 1, 2].map((row) => <div key={row} className="flex items-center gap-4"><SkeletonBlock className="h-10 w-10 shrink-0 rounded-lg" /><div className="flex flex-1 flex-col gap-2"><SkeletonBlock className="h-4 w-2/3" /><SkeletonBlock className="h-3 w-1/2" /></div></div>)}</div>)}</div>
          </div>
        </div>
      </div>
    </SkeletonStatus>
  )
}

export function SkeletonProfilePanel({ label }: { label: string }) {
  return (
    <SkeletonStatus label={label} className="flex flex-col gap-5">
      <div aria-hidden="true" className="flex flex-col gap-4 rounded-xl border border-outline bg-surface-lowest p-5 sm:flex-row sm:items-center">
        <SkeletonBlock className="h-16 w-16 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-3"><SkeletonBlock className="h-5 w-44" /><SkeletonBlock className="h-4 w-64 max-w-full" /></div>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-5 rounded-xl border border-outline bg-surface-lowest p-5">
        {[0, 1, 2].map((field) => <div key={field} className="flex flex-col gap-2"><SkeletonBlock className="h-3.5 w-28" /><SkeletonBlock className="h-10 w-full rounded-lg" /></div>)}
      </div>
    </SkeletonStatus>
  )
}
