import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { getCachedDashboard, getOfflineDashboard, getOfflineLibrary, getOfflinePalace } from './progress'

export const dashboardQueryOptions = queryOptions({
  queryKey: ['dashboard'],
  queryFn: ({ signal }) => getOfflineDashboard(signal),
  networkMode: 'always',
  refetchInterval: (query) => {
    const nextReviewAt = query.state.data?.nextReviewAt
    if (!nextReviewAt) return false
    return Math.max(1_000, Math.min(Date.parse(nextReviewAt) - Date.now(), 2_147_000_000))
  },
})

export const libraryQueryOptions = queryOptions({
  queryKey: ['library'],
  queryFn: ({ signal }) => getOfflineLibrary(signal),
  networkMode: 'always',
  staleTime: 5 * 60_000,
})

export const palaceQueryOptions = queryOptions({
  queryKey: ['palace'],
  queryFn: ({ signal }) => getOfflinePalace(signal),
  networkMode: 'always',
  staleTime: 5 * 60_000,
})

export async function loadDashboard(queryClient: QueryClient) {
  if (!queryClient.getQueryData(dashboardQueryOptions.queryKey)) {
    const cached = await getCachedDashboard()
    if (cached) queryClient.setQueryData(dashboardQueryOptions.queryKey, cached, { updatedAt: 0 })
  }
  await queryClient.ensureQueryData({ ...dashboardQueryOptions, revalidateIfStale: true })
}
