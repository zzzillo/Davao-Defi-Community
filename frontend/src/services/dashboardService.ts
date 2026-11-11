import type { AdminDashboard } from '../types/dashboard'
import { apiRequest } from './api'

export function getAdminDashboard(
  token: string,
  options: { signal?: AbortSignal } = {},
): Promise<AdminDashboard> {
  return apiRequest<AdminDashboard>('/admin/dashboard', { token, ...options })
}
