import { useMutation, useQueryClient } from '@tanstack/react-query'

import { seedLearner, type LearnerSnapshot } from './progress'
import { learnerQueryOptions } from './queries'

export function useProgressMutation<T>(save: (input: T) => Promise<LearnerSnapshot>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['progress'],
    scope: { id: 'progress' },
    networkMode: 'always',
    mutationFn: save,
    onMutate: async () => {
      await queryClient.cancelQueries(learnerQueryOptions)
      const learner = queryClient.getQueryData(learnerQueryOptions.queryKey)
      if (learner) await seedLearner(learner)
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(learnerQueryOptions.queryKey, snapshot)
    },
  })
}
