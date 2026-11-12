import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAppAuth } from '../auth/useAppAuth'
import Icon from './Icon'
import ThemeModeIcon from './ThemeModeIcon'
import { useTheme } from '../hooks/useTheme'
import { getVisibleAdminNavItems } from '../utils/adminNavigation'

export default function Topbar() {
  const { dark, toggleTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const [pagesOpen, setPagesOpen] = useState(false)
  const pagesRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { signOut, appUser } = useAppAuth()
  const navItems = appUser ? getVisibleAdminNavItems(appUser.role) : []
  const currentPage = navItems.find((item) =>
    item.to === '/admin' ? pathname === item.to : pathname.startsWith(item.to),
  )?.label ?? (pathname.startsWith('/admin/profile') ? 'Profile' : 'Admin')

  async function leaveSession() {
    setProfileOpen(false)
    try {
      await signOut()
    } catch {
      // Return to the signed-out route even if Clerk could not confirm logout.
    } finally {
      navigate('/sign-in', { replace: true })
    }
  }

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (!target.isConnected) return
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false)
      if (pagesRef.current && !pagesRef.current.contains(target)) setPagesOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileOpen(false)
        setPagesOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1 border-b border-outline bg-surface-lowest/95 px-3 backdrop-blur lg:pointer-events-none lg:absolute lg:inset-x-0 lg:top-0 lg:border-0 lg:bg-transparent lg:px-4 lg:backdrop-blur-none">
      <div ref={pagesRef} className="relative flex items-center gap-2 lg:hidden">
        <button
          type="button"
          aria-label="Admin pages"
          aria-expanded={pagesOpen}
          onClick={() => setPagesOpen((open) => !open)}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low active:scale-[0.98]"
        >
          <Icon name="menu" className="text-[24px]" />
        </button>
        <span className="max-w-[42vw] truncate text-sm font-semibold text-on-surface">{currentPage}</span>
        {pagesOpen && (
          <nav
            aria-label="Admin pages"
            className="absolute left-0 top-full mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-outline bg-surface-lowest p-1.5 shadow-float"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                onClick={() => setPagesOpen(false)}
                className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-low hover:text-on-surface'}`}
              >
                <Icon name={item.icon} className="text-[20px]" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
      <div className="flex-1" />
      <button
        type="button"
        aria-label="Toggle dark mode"
        onClick={toggleTheme}
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-low"
      >
        <ThemeModeIcon dark={dark} className="h-[22px] w-[22px]" />
      </button>
      <div ref={profileRef} className="pointer-events-auto relative ml-1">
        <button
          type="button"
          aria-label="Account"
          onClick={() => setProfileOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-surface-container text-on-surface-variant transition-opacity hover:opacity-80"
        >
          {appUser?.profile_photo_url ? (
            <img src={appUser.profile_photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon name="person" className="text-[22px]" />
          )}
        </button>
        {profileOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border border-outline bg-surface-lowest p-1 shadow-float">
            <p className="truncate px-3 py-2 text-xs font-semibold text-on-surface">{appUser?.display_name}</p>
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false)
                navigate('/admin/profile')
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
            >
              <Icon name="person" className="text-[18px]" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => void leaveSession()}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
            >
              <Icon name="logout" className="text-[18px]" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
