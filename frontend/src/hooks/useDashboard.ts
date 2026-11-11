import { ApiError } from '../services/api'
import { getAdminDashboard } from '../services/dashboardService'
import { useApiItem } from './useApiResource'

const fetchCurrentDashboard = (_key: string, options: { token?: string | null; signal?: AbortSignal }) => {
  if (!options.token) return Promise.reject(new ApiError(401, 'Please sign in to continue'))
  return getAdminDashboard(options.token, { signal: options.signal })
}

export function useDashboard() {
  const { item, ...rest } = useApiItem(fetchCurrentDashboard, 'current', {
    management: true,
    resource: 'dashboard',
  })
  return { dashboard: item, ...rest }
}
