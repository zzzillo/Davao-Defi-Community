import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import BrandLogo from './BrandLogo'
import Icon from './Icon'

export type SiteNavLink = {
  href: string
  label: string
}

export const publicNavLinks: SiteNavLink[] = [
  { href: '/events', label: 'Events' },
  { href: '/recaps', label: 'Recaps' },
  { href: '/blogs', label: 'Blogs' },
  { href: '/contributors', label: 'Contributors' },
  { href: '/partners', label: 'Partners' },
  { href: '/sign-in', label: 'Portal' },
]

type SiteNavbarProps = {
  links: SiteNavLink[]
  homeHref: string
  activeHref?: string
}

export default function SiteNavbar({ links, homeHref, activeHref }: SiteNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { dark, toggleTheme } = useTheme()

  const linkClass = (href: string, mobile = false) => {
    const active = activeHref === href
    if (mobile) {
      return `py-3 text-base transition-colors ${active ? 'font-semibold text-black dark:text-white' : 'text-gray-700 hover:text-black dark:text-[#b5b5b5] dark:hover:text-white'}`
    }
    return `text-sm transition-colors hover:text-gray-950 dark:hover:text-white sm:text-base ${active ? 'font-semibold text-gray-950 dark:text-white' : 'text-gray-600 dark:text-[#b5b5b5]'}`
  }

  return (
    <header className="relative z-40 flex h-16 w-full items-center gap-3 bg-white px-4 text-black dark:bg-black dark:text-[#f5f5f5] sm:gap-8 sm:px-6">
      <a href={homeHref} aria-label="Davao DeFi Community home" className="shrink-0">
        <BrandLogo className="h-11 w-auto" />
      </a>

      <nav aria-label="Main navigation" className="hidden flex-1 items-center gap-3 lg:flex sm:gap-8">
        {links.map((link) => (
          <a key={link.href} href={link.href} aria-current={activeHref === link.href ? 'page' : undefined} className={linkClass(link.href)}>
            {link.label}
          </a>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
        <button
          type="button"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={dark}
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F58C2F]"
        >
          <Icon name={dark ? 'light_mode' : 'dark_mode'} className="text-[22px]" />
        </button>
        <a
          href="/join-us"
          className="hidden h-10 items-center justify-center whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#F58C2F_0%,#EE2F71_100%)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EE2F71] lg:inline-flex"
        >
          Join Us
        </a>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center text-on-surface-variant transition-colors hover:text-on-surface lg:hidden"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuOpen ? <path d="M5 5l14 14M19 5 5 19" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        className={`${menuOpen ? 'flex' : 'hidden'} absolute inset-x-0 top-full flex-col gap-1 border-b border-gray-200 bg-white px-4 py-3 shadow-md dark:border-[#262626] dark:bg-black lg:hidden`}
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-current={activeHref === link.href ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
            className={linkClass(link.href, true)}
          >
            {link.label}
          </a>
        ))}
        <a
          href="/join-us"
          onClick={() => setMenuOpen(false)}
          className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#F58C2F_0%,#EE2F71_100%)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EE2F71]"
        >
          Join Us
        </a>
      </nav>
    </header>
  )
}
