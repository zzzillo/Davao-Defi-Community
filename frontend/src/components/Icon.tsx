type IconProps = {
  name: string
  className?: string
}

export default function Icon({ name, className = '' }: IconProps) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined select-none ${className}`}>
      {name}
    </span>
  )
}
