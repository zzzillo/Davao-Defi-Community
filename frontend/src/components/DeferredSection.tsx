import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'

/** Mount a below-the-fold section shortly before it enters the viewport. */
export default function DeferredSection({
  children,
  className = '',
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    if (!('IntersectionObserver' in window)) {
      setIsReady(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setIsReady(true)
      observer.disconnect()
    }, { rootMargin: '800px 0px' })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={hostRef} id={id} className={className}>
      {isReady && <Suspense fallback={null}>{children}</Suspense>}
    </div>
  )
}
