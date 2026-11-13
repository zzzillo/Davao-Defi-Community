import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useInRouterContext } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import BrandLogo from './BrandLogo'
import ThemeModeIcon from './ThemeModeIcon'

export type SiteNavLink = {
  href: string
  label: string
}

export const publicNavLinks: SiteNavLink[] = [
  { href: '/events', label: 'Events' },
  { href: '/blogs', label: 'Blogs' },
  { href: '/contributors', label: 'Contributors' },
  { href: '/partners', label: 'Partners' },
]

type SiteNavbarProps = {
  links: SiteNavLink[]
  homeHref: string
  activeHref?: string
}

type NavigationLinkProps = {
  href: string
  className: string
  children: ReactNode
  current?: boolean
  onClick?: () => void
  label?: string
}

function NavigationLink({ href, className, children, current, onClick, label }: NavigationLinkProps) {
  const inRouter = useInRouterContext()
  if (inRouter) {
    return (
      <Link to={href} aria-label={label} aria-current={current ? 'page' : undefined} onClick={onClick} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} aria-label={label} aria-current={current ? 'page' : undefined} onClick={onClick} className={className}>
      {children}
    </a>
  )
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
      <NavigationLink href={homeHref} label="Davao DeFi Community home" className="shrink-0">
        <BrandLogo className="h-11 w-auto" />
      </NavigationLink>

      <nav aria-label="Main navigation" className="hidden flex-1 items-center gap-3 lg:flex sm:gap-8">
        {links.map((link) => (
          <NavigationLink key={link.href} href={link.href} current={activeHref === link.href} className={linkClass(link.href)}>
            {link.label}
          </NavigationLink>
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
          <ThemeModeIcon dark={dark} className="h-[22px] w-[22px]" />
        </button>
        <NavigationLink
          href="/join-us"
          className="hidden h-10 items-center justify-center whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#F58C2F_0%,#EE2F71_100%)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EE2F71] lg:inline-flex"
        >
          Join Us
        </NavigationLink>
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
          <NavigationLink
            key={link.href}
            href={link.href}
            current={activeHref === link.href}
            onClick={() => setMenuOpen(false)}
            className={linkClass(link.href, true)}
          >
            {link.label}
          </NavigationLink>
        ))}
        <NavigationLink
          href="/join-us"
          onClick={() => setMenuOpen(false)}
          className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#F58C2F_0%,#EE2F71_100%)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EE2F71]"
        >
          Join Us
        </NavigationLink>
      </nav>
    </header>
  )
}
