import { Link, NavLink, Outlet } from 'react-router-dom'
import Icon from './Icon'
import { useRole } from '../hooks/useRole'
import { useTheme } from '../hooks/useTheme'
import logoDark from '../assets/DDC Logo Horizontal Dark.svg'
import logoLight from '../assets/DDC Logo Horizontal Light.svg'

/**
 * The shell every public page sits in.
 *
 * Deliberately not the admin Layout: that one is a sidebar of management links
 * a visitor cannot use, and it mounts a Topbar whose account menu assumes
 * somebody is signed in. This one assumes the opposite and treats a session as
 * the exception.
 *
 * Every public module now has a page here, which is why the nav is a list
 * rather than a set of hard-coded links.
 */
const navItems = [
  { to: '/events', label: 'Events' },
  { to: '/posts', label: 'Posts' },
  { to: '/blogs', label: 'Blog' },
  { to: '/partners', label: 'Partners' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-surface-low text-on-surface'
      : 'text-on-surface-variant hover:bg-surface-low hover:text-on-surface',
  ].join(' ')
}

export default function PublicLayout() {
  const { dark, toggleTheme } = useTheme()

  // Only decides which link to show. Nothing on these pages needs a session -
  // the API serves published events to anonymous callers.
  const { isSignedIn, canOpenAdmin } = useRole()

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <header className="sticky top-0 z-40 border-b border-outline bg-surface-lowest">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/events" className="shrink-0">
            <img
              src={logoLight}
              alt="Davao DeFi Community"
              className="block h-9 w-auto dark:hidden"
            />
            <img
              src={logoDark}
              alt="Davao DeFi Community"
              className="hidden h-9 w-auto dark:block"
            />
          </Link>

          <nav className="flex flex-1 items-center gap-1">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
          >
            <Icon name={dark ? 'light_mode' : 'dark_mode'} className="text-[22px]" />
          </button>

          {/*
            Three states, not two: a signed-in member is neither a visitor who
            should be asked to sign in, nor an official who should be offered
            the admin app. They are already home, so they get no button at all.

            ProtectedRoute makes the same decision with the same hook, so the
            link and the destination cannot disagree.
          */}
          {canOpenAdmin ? (
            <Link
              to="/admin"
              className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
            >
              Admin
            </Link>
          ) : (
            !isSignedIn && (
              <Link
                to="/sign-in"
                className="rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-on-surface transition-opacity hover:opacity-85"
              >
                Sign In
              </Link>
            )
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-outline bg-surface-lowest">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted sm:px-6">
          Davao DeFi Community
        </div>
      </footer>
    </div>
  )
}
