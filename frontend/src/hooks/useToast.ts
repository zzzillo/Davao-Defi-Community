import { createContext, useContext, useEffect, useRef } from 'react'

export type ToastKind = 'success' | 'error'

/** Shows a toast. The default is a no-op so a component rendered outside the
 *  provider degrades to silence rather than crashing. */
export type ShowToast = (kind: ToastKind, message: string) => void

/**
 * Lives here rather than beside ToastProvider because a file that exports a
 * component may not also export anything else: Vite's Fast Refresh can only
 * hot-swap a module when every export is a component, and a mixed file forces
 * a full page reload on every edit - losing whatever was typed into a form.
 */
export const ToastContext = createContext<ShowToast>(() => {})

export function useToast(): ShowToast {
  return useContext(ToastContext)
}

/** Sends a newly observed page/request error through the shared top toast. */
export function useToastError(error: unknown): void {
  const showToast = useToast()
  const previousMessage = useRef<string | null>(null)
  const baseMessage = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : null
  const fields = error && typeof error === 'object' && 'fields' in error && Array.isArray(error.fields)
    ? error.fields.map((field: { field?: unknown; message?: unknown }) => (
      typeof field?.message === 'string'
        ? `${typeof field.field === 'string' ? `${field.field}: ` : ''}${field.message}`
        : null
    )).filter((field): field is string => field !== null)
    : []
  const message = baseMessage
    ? [baseMessage, ...fields].join(' ')
    : fields.length > 0
      ? fields.join(' ')
      : null

  useEffect(() => {
    if (!message) {
      previousMessage.current = null
      return
    }
    if (previousMessage.current !== message) {
      showToast('error', message)
      previousMessage.current = message
    }
  }, [message, showToast])
}
