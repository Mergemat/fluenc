import { createServerFn } from '@tanstack/react-start'

import {
  enrollInput,
  livingLinkInput,
  movieInput,
  reviewInput,
} from './curriculum.contract'
import type { LearnerState } from '../lib/learner-state'

// Learner state is plain JSON; a raw response skips Seroval's larger encoding and slower decode.
const fetchLearnerState = createServerFn({ method: 'GET' }).handler(async () => {
  const { getLearnerStateHandler } = await import('./curriculum.handlers.server')
  return Response.json(await getLearnerStateHandler())
})

export async function getLearnerState(options?: { signal?: AbortSignal }): Promise<LearnerState> {
  const response = await fetchLearnerState(options)
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
  return response.json()
}

export const reviewItem = createServerFn({ method: 'POST' })
  .validator(reviewInput)
  .handler(async ({ data }) => {
    const { reviewItemHandler } = await import('./curriculum.handlers.server')
    return reviewItemHandler(data)
  })

export const enrollItem = createServerFn({ method: 'POST' })
  .validator(enrollInput)
  .handler(async ({ data }) => {
    const { enrollItemHandler } = await import('./curriculum.handlers.server')
    return enrollItemHandler(data)
  })

export const saveMovie = createServerFn({ method: 'POST' })
  .validator(movieInput)
  .handler(async ({ data }) => {
    const { saveMovieHandler } = await import('./curriculum.handlers.server')
    return saveMovieHandler(data)
  })

export const saveLivingLink = createServerFn({ method: 'POST' })
  .validator(livingLinkInput)
  .handler(async ({ data }) => {
    const { saveLivingLinkHandler } = await import('./curriculum.handlers.server')
    return saveLivingLinkHandler(data)
  })
