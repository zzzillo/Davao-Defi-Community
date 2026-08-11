import Icon from './Icon'

type PageHeaderProps = {
  title: string
  subtitle: string
  actionLabel?: string
  onAction?: () => void
}

export default function PageHeader({ title, subtitle, actionLabel, onAction }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface">{title}</h1>
        <p className="mt-0.5 text-sm text-on-surface-variant">{subtitle}</p>
      </div>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-2 rounded-lg bg-transparent hover:bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-colors"
        >
          <Icon name="add" className="text-[20px]" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}
