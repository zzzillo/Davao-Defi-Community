import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
  hover?: boolean
}

export default function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={[
        'rounded-xl border border-outline bg-surface-lowest',
        hover ? 'transition-shadow hover:shadow-float' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}
