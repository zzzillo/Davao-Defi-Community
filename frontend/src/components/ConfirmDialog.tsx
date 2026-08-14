type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm rounded-xl border border-outline bg-surface-lowest p-6 shadow-float">
        <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
        <p className="mt-1.5 text-sm text-on-surface-variant">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-outline bg-surface-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
