import { NavLink } from 'react-router-dom'
import Icon from './Icon'
import logoDark from '../assets/DDC Logo Horizontal Dark.svg'
import logoLight from '../assets/DDC Logo Horizontal Light.svg'

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'space_dashboard' },
  { to: '/events', label: 'Events', icon: 'calendar_month' },
  { to: '/posts', label: 'Posts', icon: 'photo_library' },
  { to: '/blogs', label: 'Blogs', icon: 'article' },
  { to: '/partners', label: 'Partners', icon: 'handshake' },
  { to: '/activity', label: 'Activity', icon: 'admin_panel_settings' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 border-l-4 px-5 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'border-primary bg-surface-container text-on-surface'
      : 'border-transparent text-on-surface-variant hover:bg-surface-low hover:text-on-surface',
  ].join(' ')
}

export default function Sidebar() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-outline bg-surface-lowest">
      <div className="h-14 shrink-0" />
      <div className="flex justify-start pb-10 pl-6 pt-4">
        <img
          src={logoLight}
          alt="Davao DeFi Community"
          className="block h-11 w-auto dark:hidden"
        />
        <img
          src={logoDark}
          alt="Davao DeFi Community"
          className="hidden h-11 w-auto dark:block"
        />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navClass}>
            <Icon name={item.icon} className="text-[22px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

    </aside>
  )
}
