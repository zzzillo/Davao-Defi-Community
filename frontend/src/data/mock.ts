import type { Status } from '../components/StatusBadge'

export type Stat = {
  label: string
  value: string
  icon: string
  trend: string | null
  trendUp: boolean
  note: string
}

export const stats: Stat[] = [
  { label: 'Total Events', value: '1,248', icon: 'calendar_month', trend: '+12%', trendUp: true, note: 'vs last month' },
  { label: 'Published Blogs', value: '342', icon: 'article', trend: '+5%', trendUp: true, note: 'vs last month' },
  { label: 'Total Partners', value: '89', icon: 'handshake', trend: '0%', trendUp: false, note: 'vs last month' },
  { label: 'Upcoming Events', value: '12', icon: 'schedule', trend: null, trendUp: false, note: 'Next 7 days' },
]

export type EventItem = {
  id: number
  name: string
  date: string
  time: string
  location: string
  description: string
  status: Status
}

export const events: EventItem[] = [
  { id: 1, name: 'DeFi Summit 2026', date: 'Oct 15, 2026', time: '09:00 AM', location: 'SMX Convention Center, Davao', description: 'The flagship gathering of DeFi builders, founders, and enthusiasts across Mindanao with talks, workshops, and networking sessions.', status: 'Upcoming' },
  { id: 2, name: 'Web3 Leadership Panel', date: 'Nov 02, 2026', time: '02:00 PM', location: 'Matina IT Park', description: 'A panel discussion with regional Web3 leaders on governance, adoption, and building sustainable communities.', status: 'Draft' },
  { id: 3, name: 'Annual DAO Retreat', date: 'Dec 10, 2026', time: '10:00 AM', location: 'Samal Island', description: 'A weekend retreat for core contributors to align on the roadmap, run workshops, and unwind together.', status: 'Review' },
  { id: 4, name: 'Q1 Protocol Kickoff', date: 'Jan 05, 2027', time: '01:00 PM', location: 'Virtual', description: 'Kickoff call covering protocol milestones, contributor onboarding, and priorities for the first quarter.', status: 'Draft' },
  { id: 5, name: 'Blockchain 101 Workshop', date: 'Sep 12, 2026', time: '10:00 AM', location: 'Virtual', description: 'A beginner-friendly workshop introducing blockchain fundamentals, wallets, and safe DeFi practices.', status: 'Completed' },
  { id: 6, name: 'Weekly Community Sync', date: 'Aug 20, 2026', time: '02:00 PM', location: 'Discord', description: 'Weekly community call for updates, open questions, and coordination across working groups.', status: 'Ongoing' },
]

export type BlogItem = {
  id: number
  title: string
  category: string
  author: string
  date: string
  description: string
  status: Status
  hasImage: boolean
}

export const blogs: BlogItem[] = [
  { id: 1, title: 'The Future of Decentralized Finance in Mindanao', category: 'DeFi', author: 'Sarah Jenkins', date: 'Aug 02, 2026', description: 'How local builders, cooperatives, and regulators are shaping a uniquely Mindanaoan take on open finance.', status: 'Published', hasImage: true },
  { id: 2, title: 'Getting Started with Smart Contract Audits', category: 'Technology', author: 'David Chen', date: 'Aug 05, 2026', description: 'A practical walkthrough of audit scopes, common vulnerability classes, and how to prepare your codebase.', status: 'Draft', hasImage: false },
  { id: 3, title: 'Community Recap: DeFi Summit Highlights', category: 'Community', author: 'Amanda Lee', date: 'Aug 08, 2026', description: "Key takeaways, standout talks, and photos from this year's biggest DeFi gathering in Davao.", status: 'Published', hasImage: true },
  { id: 4, title: 'Understanding Stablecoins and Local Adoption', category: 'Education', author: 'Product Team', date: 'Aug 10, 2026', description: 'Why price-stable digital assets matter for remittances and everyday payments in the Philippines.', status: 'Review', hasImage: false },
]

export type PostItem = {
  id: number
  author: string
  date: string
  description: string
  imageCount: number
  status: Status
  // Real event ids are UUID strings. Nothing links yet - Posts has no
  // backend - but the type has to match the day it does.
  eventId: string | null
}

export const posts: PostItem[] = [
  { id: 1, author: 'Sarah Jenkins', date: 'Aug 12, 2026', description: 'Throwback to our Blockchain 101 Workshop! Huge thanks to everyone who joined and asked great questions.', imageCount: 4, status: 'Posted', eventId: null },
  { id: 2, author: 'Amanda Lee', date: 'Aug 10, 2026', description: 'Sneak peek of the venue for DeFi Summit 2026. Registration opens next week — stay tuned!', imageCount: 2, status: 'Posted', eventId: null },
  { id: 3, author: 'Miguel Santos', date: 'Aug 08, 2026', description: 'Community meetup photo dump. See you all at the next Weekly Sync!', imageCount: 6, status: 'Draft', eventId: null },
]

export const permissionOptions = ['Blogs', 'Events', 'Partners', 'Activity'] as const

export const departmentOptions = [
  'Leadership',
  'Community Team',
  'Events Team',
  'Marketing Team',
  'Content Team',
  'Partnerships',
  'Developer Relations',
  'Operations',
] as const

export type UserItem = {
  id: number
  name: string
  email: string
  role: string
  department: string
  permissions: string[]
}

export const users: UserItem[] = [
  { id: 1, name: 'Sarah Jenkins', email: 'sarah@davaodefi.org', role: 'CEO', department: 'Leadership', permissions: ['Blogs', 'Events', 'Partners', 'Activity'] },
  { id: 2, name: 'David Chen', email: 'david@davaodefi.org', role: 'CTO', department: 'Developer Relations', permissions: ['Blogs'] },
  { id: 3, name: 'Amanda Lee', email: 'amanda@davaodefi.org', role: 'COO', department: 'Operations', permissions: ['Blogs', 'Events'] },
  { id: 4, name: 'Miguel Santos', email: 'miguel@davaodefi.org', role: 'Community Manager', department: 'Community Team', permissions: [] },
]

export const currentUser = {
  name: 'Sarah Jenkins',
  email: 'sarah@davaodefi.org',
}
