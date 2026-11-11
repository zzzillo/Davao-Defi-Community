import { lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import SiteNavbar, { publicNavLinks } from './SiteNavbar'

const LandingFooter = lazy(() => import('./LandingFooter'))

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
  const isLanding = pathname === '/'

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className={`${isLanding ? 'relative' : 'sticky top-0'} z-40 bg-surface-lowest`}>
        <SiteNavbar
          homeHref={isLanding ? '#landing-home' : '/'}
          activeHref={isLanding ? undefined : pathname}
          links={publicNavLinks}
        />
      </div>

      <main className="public-content flex-1">
        {isLanding ? <Outlet /> : (
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
            <Outlet />
          </div>
        )}
      </main>

      {!isLanding && (
        <Suspense fallback={null}>
          <LandingFooter animated={false} />
        </Suspense>
      )}
    </div>
  )
}
