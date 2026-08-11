export type Status =
  | 'Published'
  | 'Draft'
  | 'Review'
  | 'Upcoming'
  | 'Ongoing'
  | 'Completed'
  | 'Active'
  | 'Pending'
  | 'Archived'

const styles: Record<Status, string> = {
  Published: 'bg-success-bg text-success',
  Active: 'bg-success-bg text-success',
  Review: 'bg-warning-bg text-warning',
  Pending: 'bg-warning-bg text-warning',
  Draft: 'bg-surface-low text-on-surface-variant',
  Upcoming: 'bg-surface-low text-on-surface-variant',
  Ongoing: 'bg-surface-low text-on-surface-variant',
  Completed: 'bg-surface-low text-on-surface-variant',
  Archived: 'bg-surface-low text-on-surface-variant',
}

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  )
}
