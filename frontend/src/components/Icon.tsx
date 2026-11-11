type IconProps = {
  name: string
  className?: string
}

export default function Icon({ name, className = '' }: IconProps) {
  const loadingClass = name === 'progress_activity' ? 'inline-block animate-spin' : ''

  return (
    <span aria-hidden="true" className={`material-symbols-outlined select-none ${loadingClass} ${className}`}>
      {name}
    </span>
  )
}
