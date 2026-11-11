import type { ActivityLogResponse } from './activityLog'
import type { AppRole } from './user'

export type DashboardTotals = {
  blogs?: number
  blog_drafts?: number
  events?: number
  event_drafts?: number
  posts?: number
  post_drafts?: number
  partners?: number
  users?: number
  activity?: number
}

export type AdminDashboard = {
  role: AppRole
  totals: DashboardTotals
  recent_work: ActivityLogResponse[]
}
