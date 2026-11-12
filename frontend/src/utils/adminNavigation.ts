import { canAccessModule, type AdminModule } from './roles'
import type { AppRole } from '../types/user'

// Destinations shared by the wide sidebar and the compact page menu.
export const adminNavItems = [
  { to: '/admin', label: 'Dashboard', icon: 'space_dashboard' },
  { to: '/admin/events', label: 'Events', icon: 'calendar_month' },
  { to: '/admin/posts', label: 'Recaps', icon: 'photo_library' },
  { to: '/admin/blogs', label: 'Blogs', icon: 'article' },
  { to: '/admin/partners', label: 'Partners', icon: 'handshake' },
  { to: '/admin/users', label: 'Users', icon: 'group' },
  { to: '/admin/activity', label: 'Activity', icon: 'history' },
]

export function getVisibleAdminNavItems(role: AppRole) {
  return adminNavItems.filter((item) => {
    if (item.to === '/admin') return true
    return canAccessModule(role, item.to.split('/').at(-1) as AdminModule)
  })
}
