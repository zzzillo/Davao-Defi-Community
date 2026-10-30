import { Outlet, useLocation } from 'react-router-dom'
import LandingFooter from './LandingFooter'
import SiteNavbar, { publicNavLinks } from './SiteNavbar'
import { useRole } from '../hooks/useRole'

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
export default function PublicLayout() {
  const { pathname } = useLocation()
  const { isSignedIn } = useRole()

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <div className="sticky top-0 z-40 bg-surface-lowest">
        <SiteNavbar
          homeHref="/"
          activeHref={pathname}
          links={publicNavLinks.map((link) => (
            link.label === 'Portal' && isSignedIn ? { ...link, href: '/admin' } : link
          ))}
        />
      </div>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <Outlet />
        </div>
      </main>

      <LandingFooter animated={false} />
    </div>
  )
}
