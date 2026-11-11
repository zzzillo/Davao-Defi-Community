import { NavLink } from 'react-router-dom'
import Icon from './Icon'
import BrandLogo from './BrandLogo'
import { useAppUser } from '../auth/useAppAuth'
import { canAccessModule } from '../utils/roles'

// The admin app's own navigation. Public pages get their own shell, so no
// entry here should ever point outside /admin.
const navItems = [
  { to: '/admin', label: 'Dashboard', icon: 'space_dashboard' },
  { to: '/admin/events', label: 'Events', icon: 'calendar_month' },
  { to: '/admin/posts', label: 'Recaps', icon: 'photo_library' },
  { to: '/admin/blogs', label: 'Blogs', icon: 'article' },
  { to: '/admin/partners', label: 'Partners', icon: 'handshake' },
  { to: '/admin/users', label: 'Users', icon: 'group' },
  { to: '/admin/activity', label: 'Activity', icon: 'history' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 border-l-4 px-5 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'border-primary bg-surface-container text-on-surface'
      : 'border-transparent text-on-surface-variant hover:bg-surface-low hover:text-on-surface',
  ].join(' ')
}

export default function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const appUser = useAppUser()
  const visibleItems = appUser
    ? navItems.filter((item) => item.to === '/admin' || canAccessModule(appUser.role, item.to.split('/').at(-1) as 'blogs' | 'events' | 'posts' | 'partners' | 'users' | 'activity'))
    : []

  return (
    <aside className={`flex h-full shrink-0 flex-col border-r border-outline bg-surface-lowest ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="h-14 shrink-0" />
      {!collapsed && (
        <div className="flex justify-start pb-10 pl-6 pt-4">
          <BrandLogo className="h-11 w-auto" />
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            className={({ isActive }) => `${navClass({ isActive })} ${collapsed ? 'justify-center gap-0 border-l-0 px-0' : ''}`}
          >
            <Icon name={item.icon} className="text-[22px]" />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

    </aside>
  )
}
