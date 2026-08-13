import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Icon from './Icon'

type ToastKind = 'success' | 'error'
type ToastState = { kind: ToastKind; message: string } | null

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null)
  const [visible, setVisible] = useState(false)
  const timers = useRef<number[]>([])

  const show = useCallback((kind: ToastKind, message: string) => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setToast({ kind, message })
    timers.current.push(window.setTimeout(() => setVisible(true), 20))
    timers.current.push(window.setTimeout(() => setVisible(false), 1800))
    timers.current.push(window.setTimeout(() => setToast(null), 2150))
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center">
          <div
            className={`flex items-center gap-2.5 rounded-xl border border-outline bg-surface px-5 py-3 text-sm font-medium text-on-surface shadow-[0_12px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.6)] transition-all duration-300 ${
              visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
            }`}
          >
            <Icon
              name={toast.kind === 'success' ? 'check_circle' : 'error'}
              className={`icon-filled text-[20px] ${
                toast.kind === 'success' ? 'text-success' : 'text-error'
              }`}
            />
            {toast.message}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
