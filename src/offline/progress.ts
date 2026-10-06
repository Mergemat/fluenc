import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import { isStudyItemType } from '../data/types'
import { applyOperation, applyLibraryOperation, applyPalaceOperation, refreshDueQueues, type ProgressOperation } from './progress-state'

import type {
  EnrollInput,
  LivingLinkInput,
  MovieInput,
  ReviewInput,
} from '../server/curriculum.contract'
import {
  enrollItem,
  getDashboard,
  getLibrary,
  getPalace,
  reviewItem,
  saveLivingLink,
  saveMovie,
  type DashboardData,
  type LibraryData,
  type PalaceData,
} from '../server/curriculum'

type OutboxEntry = ProgressOperation & {
  sequence?: number
}

type CacheKey = 'dashboard' | 'library' | 'palace'
const cacheKey = (key: CacheKey) => `lessons-v3:${key}` as const
type StoredCacheKey = ReturnType<typeof cacheKey>

interface FluencOfflineDatabase extends DBSchema {
  cache: {
    key: StoredCacheKey
    value: { key: StoredCacheKey; value: unknown }
  }
  outbox: {
    key: number
    value: OutboxEntry
  }
}

let databasePromise: Promise<IDBPDatabase<FluencOfflineDatabase>> | null = null
let activeFlush: Promise<number> | null = null
let progressRevision = 0

function getDatabase() {
  databasePromise ??= openDB<FluencOfflineDatabase>('fluenc-offline', 1, {
    upgrade(database) {
      database.createObjectStore('cache', { keyPath: 'key' })
      database.createObjectStore('outbox', { keyPath: 'sequence', autoIncrement: true })
    },
  })
  return databasePromise
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
}

async function readCache<T>(key: CacheKey) {
  if (!isBrowser()) return null
  const cached = await (await getDatabase()).get('cache', cacheKey(key))
  return cached?.value as T | undefined ?? null
}

// Check and write in one transaction so a response cannot overwrite unsynced work.
async function acceptRemoteCache<T>(key: CacheKey, data: T, revision: number) {
  const database = await getDatabase()
  const transaction = database.transaction(['cache', 'outbox'], 'readwrite')
  const pending = await transaction.objectStore('outbox').count()
  const cache = transaction.objectStore('cache')
  if (!pending && revision === progressRevision) {
    await cache.put({ key: cacheKey(key), value: data })
    await transaction.done
    return data
  }
  const cached = await cache.get(cacheKey(key))
  await transaction.done
  return cached ? cached.value as T : data
}

export async function persistDashboard(data: DashboardData) {
  if (isBrowser()) await acceptRemoteCache('dashboard', data, progressRevision)
}

export async function getOfflineDashboard(signal?: AbortSignal) {
  if (!isBrowser()) return getDashboard({ signal })
  if (!navigator.onLine || await hasPendingProgress()) {
    const cached = await getCachedDashboard()
    if (cached) return cached
  }
  const revision = progressRevision
  try {
    const data = await getDashboard({ signal })
    signal?.throwIfAborted()
    return refreshDueQueues(await acceptRemoteCache('dashboard', data, revision))
  } catch (error) {
    signal?.throwIfAborted()
    const cached = await getCachedDashboard()
    if (cached) return cached
    throw error
  }
}

async function getOfflineQuery<T>(key: Exclude<CacheKey, 'dashboard'>, remote: () => Promise<T>, signal?: AbortSignal, isCurrent: (value: T) => boolean = () => true) {
  if (!isBrowser()) return remote()
  const stored = await readCache<T>(key)
  const cached = stored && isCurrent(stored) ? stored : null
  if (cached && (!navigator.onLine || await hasPendingProgress())) return cached
  const revision = progressRevision
  try {
    const data = await remote()
    signal?.throwIfAborted()
    return acceptRemoteCache(key, data, revision)
  } catch (error) {
    signal?.throwIfAborted()
    // Read again because a local save may have happened during the request.
    const latest = await readCache<T>(key)
    if (latest && isCurrent(latest)) return latest
    throw error
  }
}

export function getOfflineLibrary(signal?: AbortSignal) {
  // Libraries cached before entries carried components and word parts must be refetched.
  return getOfflineQuery<LibraryData>('library', () => getLibrary({ signal }), signal, library => 'components' in (library.characters[0] ?? {}) && 'characterParts' in (library.words[0] ?? {}))
}

export function getOfflinePalace(signal?: AbortSignal) {
  return getOfflineQuery<PalaceData>('palace', () => getPalace({ signal }), signal)
}

export type ProgressSnapshot = {
  dashboard: DashboardData
  library?: LibraryData
  palace?: PalaceData
}

async function enqueue(operation: ProgressOperation): Promise<ProgressSnapshot> {
  progressRevision += 1
  const database = await getDatabase()
  const transaction = database.transaction(['cache', 'outbox'], 'readwrite')
  const cached = await transaction.objectStore('cache').get(cacheKey('dashboard'))
  if (!cached) throw new Error('Open Fluenc online once before saving progress offline')
  const nextDashboard = applyOperation(cached.value as DashboardData, operation)
  await transaction.objectStore('cache').put({
    key: cacheKey('dashboard'),
    value: nextDashboard,
  })
  const snapshot: ProgressSnapshot = { dashboard: nextDashboard }
  const library = await transaction.objectStore('cache').get(cacheKey('library'))
  if (library && (operation.kind === 'enroll' || operation.kind === 'review' || operation.kind === 'livingLink')) {
    snapshot.library = applyLibraryOperation(library.value as LibraryData, nextDashboard, operation)
    await transaction.objectStore('cache').put({
      key: cacheKey('library'),
      value: snapshot.library,
    })
  }
  const palace = await transaction.objectStore('cache').get(cacheKey('palace'))
  if (palace && operation.kind === 'movie') {
    snapshot.palace = applyPalaceOperation(palace.value as PalaceData, operation)
    await transaction.objectStore('cache').put({
      key: cacheKey('palace'),
      value: snapshot.palace,
    })
  }
  await transaction.objectStore('outbox').add(operation)
  await transaction.done
  return snapshot
}

async function sendOperation(operation: ProgressOperation) {
  if (operation.kind === 'review') return reviewItem({ data: operation.data })
  if (operation.kind === 'enroll') return enrollItem({ data: operation.data })
  if (operation.kind === 'movie') return saveMovie({ data: operation.data })
  return saveLivingLink({ data: operation.data })
}

async function performFlush() {
  if (!isBrowser() || !navigator.onLine) return 0
  const database = await getDatabase()
  let synced = 0
  while (navigator.onLine) {
    const transaction = database.transaction('outbox', 'readonly')
    const cursor = await transaction.store.openCursor()
    await transaction.done
    if (!cursor) break
    try {
      if (cursor.value.kind !== 'review' || isStudyItemType(cursor.value.data.itemType)) {
        await sendOperation(cursor.value)
      }
      await database.delete('outbox', cursor.primaryKey)
      synced += 1
    } catch {
      break
    }
  }
  return synced
}

export async function flushProgress() {
  if (!activeFlush) {
    activeFlush = performFlush().finally(() => {
      activeFlush = null
    })
  }
  return activeFlush
}

export function saveEnrollment(data: Omit<EnrollInput, 'enrolledAt'>) {
  return enqueue({
    kind: 'enroll',
    data: { ...data, enrolledAt: new Date().toISOString() },
  })
}

export function saveLivingLinkOffline(data: LivingLinkInput) {
  return enqueue({ kind: 'livingLink', data })
}

export function saveMovieOffline(data: MovieInput) {
  return enqueue({ kind: 'movie', data })
}

export function saveReview(data: Omit<ReviewInput, 'eventId' | 'reviewedAt'>) {
  return enqueue({
    kind: 'review',
    data: {
      ...data,
      eventId: crypto.randomUUID(),
      reviewedAt: new Date().toISOString(),
    },
  })
}

export async function getCachedDashboard() {
  const cached = await readCache<DashboardData>('dashboard')
  if (!cached) return null
  return refreshDueQueues(cached)
}

export async function hasPendingProgress() {
  return isBrowser() && (await (await getDatabase()).count('outbox')) > 0
}
