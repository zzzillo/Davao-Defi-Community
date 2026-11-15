import type { ReactNode } from 'react'

/** Reserve layout space for a landing section while preserving its static HTML. */
export default function DeferredSection({
  children,
  className = '',
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <div id={id} className={className}>{children}</div>
  )
}
