import { useMutation, useQueryClient } from '@tanstack/react-query'

import { persistDashboard, type ProgressSnapshot } from './progress'
import { dashboardQueryOptions, libraryQueryOptions, palaceQueryOptions } from './queries'

export function useProgressMutation<T>(save: (input: T) => Promise<ProgressSnapshot>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['progress'],
    scope: { id: 'progress' },
    networkMode: 'always',
    mutationFn: save,
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries(dashboardQueryOptions),
        queryClient.cancelQueries(libraryQueryOptions),
        queryClient.cancelQueries(palaceQueryOptions),
      ])
      const dashboard = queryClient.getQueryData(dashboardQueryOptions.queryKey)
      if (dashboard) await persistDashboard(dashboard)
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(dashboardQueryOptions.queryKey, snapshot.dashboard)
      if (snapshot.library) queryClient.setQueryData(libraryQueryOptions.queryKey, snapshot.library)
      if (snapshot.palace) queryClient.setQueryData(palaceQueryOptions.queryKey, snapshot.palace)
    },
  })
}
