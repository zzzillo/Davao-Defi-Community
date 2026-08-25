import { createContext, useContext } from 'react'

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
