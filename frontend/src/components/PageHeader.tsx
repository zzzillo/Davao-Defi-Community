import Icon from './Icon'

type PageHeaderProps = {
  title: string
  subtitle: string
  actionLabel?: string
  onAction?: () => void
  hideActionOnMobile?: boolean
}

export default function PageHeader({ title, subtitle, actionLabel, onAction, hideActionOnMobile = false }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
      <div className="min-w-0 basis-full flex-1 sm:basis-auto">
        <h1 className="text-lg font-semibold leading-tight tracking-tight text-on-surface sm:text-2xl">{title}</h1>
        <p className="mt-1 max-w-xl text-xs leading-5 text-on-surface-variant sm:mt-0.5 sm:text-sm">{subtitle}</p>
      </div>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className={`${hideActionOnMobile ? 'hidden sm:flex' : 'flex'} shrink-0 items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-btn sm:px-4`}
        >
          <Icon name="add" className="text-[20px]" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}
