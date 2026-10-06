import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import { isStudyItemType } from '../data/types'
import { applyOperation, type LearnerState, type ProgressOperation } from '../lib/learner-state'
import type {
  EnrollInput,
  LivingLinkInput,
  MovieInput,
  ReviewInput,
} from '../server/curriculum.contract'
import {
  enrollItem,
  getLearnerState,
  reviewItem,
  saveLivingLink,
  saveMovie,
} from '../server/curriculum'
import { learnerStateFromLegacy, legacyCacheKeys } from './legacy-cache'

type OutboxEntry = ProgressOperation & {
  sequence?: number
}

const STATE_KEY = 'learner-v1'

interface FluencOfflineDatabase extends DBSchema {
  cache: {
    key: string
    value: { key: string; value: unknown }
  }
  outbox: {
    key: number
    value: OutboxEntry
  }
}

/** Learner state and the moment its due queues were read; a newer moment moves due cards into review. */
export type LearnerSnapshot = { state: LearnerState; at: number }

const snapshotOf = (state: LearnerState): LearnerSnapshot => ({ state, at: Date.now() })

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

async function readState(): Promise<LearnerState | null> {
  if (!isBrowser()) return null
  const database = await getDatabase()
  const stored = await database.get('cache', STATE_KEY)
  return stored ? stored.value as LearnerState : migrateLegacyCache(database)
}

// Progress saved before devices stored learner state survives an update, even one made offline.
async function migrateLegacyCache(database: IDBPDatabase<FluencOfflineDatabase>) {
  const transaction = database.transaction('cache', 'readwrite')
  const [stored, dashboard, library, palace] = await Promise.all([STATE_KEY, ...legacyCacheKeys].map(key => transaction.store.get(key)))
  if (stored || !dashboard) {
    await transaction.done
    return stored ? stored.value as LearnerState : null
  }
  const state = learnerStateFromLegacy(
    dashboard.value as Parameters<typeof learnerStateFromLegacy>[0],
    library?.value as Parameters<typeof learnerStateFromLegacy>[1],
    palace?.value as Parameters<typeof learnerStateFromLegacy>[2],
  )
  await transaction.store.put({ key: STATE_KEY, value: state })
  await Promise.all(legacyCacheKeys.map(key => transaction.store.delete(key)))
  await transaction.done
  return state
}

// Check and write in one transaction so a response cannot overwrite unsynced work.
async function acceptRemoteState(remote: LearnerState, revision: number) {
  await readState()
  const database = await getDatabase()
  const transaction = database.transaction(['cache', 'outbox'], 'readwrite')
  const outbox = transaction.objectStore('outbox')
  const cache = transaction.objectStore('cache')
  const pending = await outbox.count()
  if (!pending && revision === progressRevision) {
    await cache.put({ key: STATE_KEY, value: remote })
    await Promise.all(legacyCacheKeys.map(key => cache.delete(key)))
    await transaction.done
    return remote
  }
  const cached = await cache.get(STATE_KEY)
  if (cached) {
    await transaction.done
    return cached.value as LearnerState
  }
  // No local copy to protect: replay unsynced saves on the server's state.
  const state = (await outbox.getAll()).reduce((next, operation) => applyOperation(next, operation), remote)
  await cache.put({ key: STATE_KEY, value: state })
  await transaction.done
  return state
}

/** Store learner state received outside a query, such as one rendered on the server. */
export async function persistLearner(data: LearnerSnapshot) {
  if (isBrowser()) await acceptRemoteState(data.state, progressRevision)
}

/** Store learner state only when the device has none yet. */
export async function seedLearner(data: LearnerSnapshot) {
  if (isBrowser() && !await readState()) await acceptRemoteState(data.state, progressRevision)
}

export async function getCachedLearner() {
  const state = await readState()
  return state ? snapshotOf(state) : null
}

export async function getOfflineLearner(signal?: AbortSignal): Promise<LearnerSnapshot> {
  if (!isBrowser()) return snapshotOf(await getLearnerState({ signal }))
  if (!navigator.onLine || await hasPendingProgress()) {
    const cached = await getCachedLearner()
    if (cached) return cached
  }
  const revision = progressRevision
  try {
    const remote = await getLearnerState({ signal })
    signal?.throwIfAborted()
    return snapshotOf(await acceptRemoteState(remote, revision))
  } catch (error) {
    signal?.throwIfAborted()
    const cached = await getCachedLearner()
    if (cached) return cached
    throw error
  }
}

async function enqueue(operation: ProgressOperation): Promise<LearnerSnapshot> {
  progressRevision += 1
  const database = await getDatabase()
  const transaction = database.transaction(['cache', 'outbox'], 'readwrite')
  const cached = await transaction.objectStore('cache').get(STATE_KEY)
  if (!cached) throw new Error('Open Fluenc online once before saving progress offline')
  const state = applyOperation(cached.value as LearnerState, operation)
  await transaction.objectStore('cache').put({ key: STATE_KEY, value: state })
  await transaction.objectStore('outbox').add(operation)
  await transaction.done
  return snapshotOf(state)
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

export async function hasPendingProgress() {
  return isBrowser() && (await (await getDatabase()).count('outbox')) > 0
}
