import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { QueryClient } from '@tanstack/react-query'

import type { DashboardData } from '../server/curriculum'

const dashboardRequest = mock(async (): Promise<DashboardData> => fixture())
const enrollRequest = mock(async (_input: unknown): Promise<unknown> => ({}))
const reviewRequest = mock(async (_input: unknown): Promise<unknown> => ({}))
mock.module('../server/curriculum', () => ({
  getDashboard: dashboardRequest,
  enrollItem: enrollRequest,
  reviewItem: reviewRequest,
  getLibrary: mock(async () => ({ characters: [], words: [] })),
  getPalace: mock(async () => ({ actors: [], sets: [], props: [], rooms: [] })),
  saveMovie: mock(async () => ({})),
  saveLivingLink: mock(async () => ({})),
}))

const { flushProgress, getCachedDashboard, getOfflineDashboard, hasPendingProgress, persistDashboard, saveEnrollment, saveReview } = await import('./progress')
const { loadDashboard, dashboardQueryOptions } = await import('./queries')
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })

function fixture(): DashboardData {
  return {
    curriculum: { version: 'test', characters: 0, words: 0 },
    progress: { introducedCharacters: 0, introducedWords: 0 },
    reviewQueue: [], buildQueue: [], lockedWords: [], scheduledQueue: [], nextReviewAt: null,
    getQueue: ['s01', 's02'].map((id) => ({
      id, hanzi: '你好。', pinyin: 'Nǐ hǎo.', meaning: 'Hi.', words: ['你', '好'],
      coverage: 1, missingWords: [], missingCharacters: [],
    })),
  }
}

beforeEach(async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
  dashboardRequest.mockReset().mockImplementation(async () => fixture())
  enrollRequest.mockReset().mockImplementation(async () => ({}))
  reviewRequest.mockReset().mockImplementation(async () => ({}))
  await persistDashboard(fixture())
  const database = await openDB('fluenc-offline', 1)
  await database.clear('outbox')
  await database.clear('cache')
  database.close()
  await persistDashboard(fixture())
})

afterAll(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else Reflect.deleteProperty(globalThis, 'navigator')
  mock.restore()
})

test('a stalled server does not hold up enrollment, rating, or the next card', async () => {
  const started = Promise.withResolvers<void>()
  const response = Promise.withResolvers<unknown>()
  enrollRequest.mockImplementationOnce(() => { started.resolve(); return response.promise })
  await saveEnrollment({ itemType: 'sentence', itemId: 's01' })
  const flush = flushProgress()
  await started.promise
  try {
    const next = await saveEnrollment({ itemType: 'sentence', itemId: 's02' })
    expect(next.dashboard.reviewQueue.map(item => item.id)).toEqual(['s01', 's02'])
    const rated = await saveReview({ itemType: 'sentence', itemId: 's01', rating: 3, durationMs: 100 })
    expect(rated.dashboard.reviewQueue.map(item => item.id)).toEqual(['s02'])
    expect(rated.dashboard.scheduledQueue[0]?.reps).toBe(1)
    expect((await getCachedDashboard())?.reviewQueue.map(item => item.id)).toEqual(['s02'])
    expect((await getOfflineDashboard()).reviewQueue.map(item => item.id)).toEqual(['s02'])
    expect(dashboardRequest).not.toHaveBeenCalled()
  } finally {
    response.resolve({})
    await flush
  }
  expect(await hasPendingProgress()).toBe(false)
  expect(enrollRequest).toHaveBeenCalledTimes(2)
  expect(reviewRequest).toHaveBeenCalledTimes(1)
})

test('a late dashboard response cannot restore a card even after its save has synced', async () => {
  const started = Promise.withResolvers<void>()
  const response = Promise.withResolvers<DashboardData>()
  dashboardRequest.mockImplementationOnce(() => { started.resolve(); return response.promise })
  const fetch = getOfflineDashboard()
  await started.promise
  await saveEnrollment({ itemType: 'sentence', itemId: 's01' })
  await flushProgress()
  expect(await hasPendingProgress()).toBe(false)
  response.resolve(fixture())
  expect((await fetch).reviewQueue.map(item => item.id)).toEqual(['s01'])
  expect((await getCachedDashboard())?.getQueue.map(item => item.id)).toEqual(['s02'])
})

test('failed sync retains ordered operations and retries the same review event', async () => {
  await saveEnrollment({ itemType: 'sentence', itemId: 's01' })
  await saveReview({ itemType: 'sentence', itemId: 's01', rating: 4, durationMs: 100 })
  reviewRequest.mockRejectedValueOnce(new Error('Connection lost after sending'))
  expect(await flushProgress()).toBe(1)
  expect(await hasPendingProgress()).toBe(true)
  expect((await getCachedDashboard())?.reviewQueue).toHaveLength(0)
  expect(await flushProgress()).toBe(1)
  expect(reviewRequest.mock.calls[0]).toEqual(reviewRequest.mock.calls[1])
  expect(await hasPendingProgress()).toBe(false)
})

test('concurrent local saves and a stale persisted snapshot do not lose progress', async () => {
  await Promise.all([
    saveEnrollment({ itemType: 'sentence', itemId: 's01' }),
    saveEnrollment({ itemType: 'sentence', itemId: 's02' }),
  ])
  await persistDashboard(fixture())
  expect((await getCachedDashboard())?.reviewQueue.map(item => item.id).sort()).toEqual(['s01', 's02'])
  expect((await getCachedDashboard())?.getQueue).toHaveLength(0)
})

test('offline saves advance locally and can be synchronized after reconnecting', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } })
  await saveEnrollment({ itemType: 'sentence', itemId: 's01' })
  await saveReview({ itemType: 'sentence', itemId: 's01', rating: 1, durationMs: 100 })
  expect(await flushProgress()).toBe(0)
  expect((await getOfflineDashboard()).scheduledQueue).toHaveLength(1)
  expect(enrollRequest).not.toHaveBeenCalled()
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
  expect(await flushProgress()).toBe(2)
})

test('cancelled requests cannot write their response into the offline cache', async () => {
  const started = Promise.withResolvers<void>()
  const response = Promise.withResolvers<DashboardData>()
  dashboardRequest.mockImplementationOnce(() => { started.resolve(); return response.promise })
  const controller = new AbortController()
  const fetch = getOfflineDashboard(controller.signal)
  const rejected = fetch.catch((error: unknown) => error)
  await started.promise
  controller.abort()
  response.resolve({ ...fixture(), getQueue: [] })
  expect(await rejected).toBeInstanceOf(Error)
  expect((await getCachedDashboard())?.getQueue).toHaveLength(2)
})

test('cold offline startup restores the last synced snapshot without contacting the server', async () => {
  await saveEnrollment({ itemType: 'sentence', itemId: 's01' })
  await saveReview({ itemType: 'sentence', itemId: 's01', rating: 3, durationMs: 100 })
  await flushProgress()
  expect(await hasPendingProgress()).toBe(false)
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } })
  const client = new QueryClient()
  try {
    await loadDashboard(client)
    const dashboard = client.getQueryData(dashboardQueryOptions.queryKey)
    expect(dashboard?.reviewQueue).toHaveLength(0)
    expect(dashboard?.scheduledQueue[0]?.id).toBe('s01')
    expect(dashboard?.getQueue.map(item => item.id)).toEqual(['s02'])
    expect(dashboardRequest).not.toHaveBeenCalled()
  } finally {
    client.clear()
  }
})

test('cold startup opens cached lessons while a network refresh is still pending', async () => {
  const started = Promise.withResolvers<void>()
  const response = Promise.withResolvers<DashboardData>()
  dashboardRequest.mockImplementationOnce(() => { started.resolve(); return response.promise })
  const client = new QueryClient()
  try {
    await loadDashboard(client)
    await started.promise
    expect(client.getQueryData(dashboardQueryOptions.queryKey)?.getQueue).toHaveLength(2)
    expect(client.isFetching()).toBe(1)
    response.resolve({ ...fixture(), getQueue: [] })
    await client.fetchQuery(dashboardQueryOptions)
    expect(client.getQueryData(dashboardQueryOptions.queryKey)?.getQueue).toHaveLength(0)
  } finally {
    response.resolve(fixture())
    client.clear()
  }
})
