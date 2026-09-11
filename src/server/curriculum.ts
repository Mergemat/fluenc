import { createServerFn } from '@tanstack/react-start'

import {
  enrollInput,
  livingLinkInput,
  movieInput,
  reviewInput,
} from './curriculum.contract'

export const getDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDashboardHandler } = await import('./curriculum.handlers.server')
  return getDashboardHandler()
})

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

export const getLibrary = createServerFn({ method: 'GET' }).handler(async () => {
  const { getLibraryHandler } = await import('./curriculum.handlers.server')
  return getLibraryHandler()
})

export const getPalace = createServerFn({ method: 'GET' }).handler(async () => {
  const { getPalaceHandler } = await import('./curriculum.handlers.server')
  return getPalaceHandler()
})

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>
export type BuildItem = DashboardData['buildQueue'][number]
export type ReviewItem = DashboardData['reviewQueue'][number]
export type CodebookItem = DashboardData['codebookQueue'][number]
export type StudyItem = BuildItem | ReviewItem
export type LibraryData = Awaited<ReturnType<typeof getLibrary>>
export type PalaceData = Awaited<ReturnType<typeof getPalace>>
