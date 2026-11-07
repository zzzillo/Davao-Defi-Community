type ThemeModeIconProps = {
  dark: boolean
  className?: string
}

export default function ThemeModeIcon({ dark, className = '' }: ThemeModeIconProps) {
  return dark ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.1 15.4A8 8 0 0 1 8.6 4.9 8.5 8.5 0 1 0 19.1 15.4Z" />
    </svg>
  )
}
