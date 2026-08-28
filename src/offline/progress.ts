import { createEmptyCard, fsrs, State, type Card, type Grade } from 'ts-fsrs'
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type {
  EnrollInput,
  LivingLinkInput,
  MovieInput,
  PreferencesInput,
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
  savePreferences,
  type DashboardData,
  type LibraryData,
  type PalaceData,
} from '../server/curriculum'

type ProgressOperation =
  | { kind: 'enroll'; data: EnrollInput }
  | { kind: 'livingLink'; data: LivingLinkInput }
  | { kind: 'movie'; data: MovieInput }
  | { kind: 'preferences'; data: PreferencesInput }
  | { kind: 'review'; data: ReviewInput }

type OutboxEntry = ProgressOperation & {
  sequence?: number
}

type CacheKey = 'dashboard' | 'library' | 'palace'

interface FluencOfflineDatabase extends DBSchema {
  cache: {
    key: CacheKey
    value: { key: CacheKey; value: unknown }
  }
  outbox: {
    key: number
    value: OutboxEntry
  }
}

type CardSnapshot = DashboardData['scheduledQueue'][number]['card']
type ReviewQueueItem = DashboardData['reviewQueue'][number]
type CodebookQueueItem = DashboardData['codebookQueue'][number]
type ScheduledQueueItem = DashboardData['scheduledQueue'][number]

const scheduler = fsrs({
  request_retention: 0.9,
  enable_short_term: true,
  learning_steps: ['10m'],
  relearning_steps: ['10m'],
})

let databasePromise: Promise<IDBPDatabase<FluencOfflineDatabase>> | null = null
let activeFlush: Promise<number> | null = null

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

function toCard(snapshot: CardSnapshot): Card {
  return {
    due: new Date(snapshot.due),
    stability: snapshot.stability,
    difficulty: snapshot.difficulty,
    elapsed_days: snapshot.elapsedDays,
    scheduled_days: snapshot.scheduledDays,
    learning_steps: snapshot.learningSteps,
    reps: snapshot.reps,
    lapses: snapshot.lapses,
    state: snapshot.state,
    last_review: snapshot.lastReview ? new Date(snapshot.lastReview) : undefined,
  }
}

function toSnapshot(card: Card): CardSnapshot {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.toISOString() ?? null,
  }
}

function itemKey(item: { type: string; id: string }) {
  return `${item.type}:${item.id}`
}

function refreshDueQueues(data: DashboardData, now = new Date()) {
  const next = structuredClone(data)
  const due = next.scheduledQueue.filter((item) => Date.parse(item.card.due) <= now.getTime())
  next.scheduledQueue = next.scheduledQueue.filter((item) => Date.parse(item.card.due) > now.getTime())

  const reviewKeys = new Set(next.reviewQueue.map(itemKey))
  const codebookKeys = new Set(next.codebookQueue.map(itemKey))
  for (const item of due) {
    if (item.type === 'actor' || item.type === 'set' || item.type === 'tone') {
      if (!codebookKeys.has(itemKey(item))) next.codebookQueue.push(item as CodebookQueueItem)
    } else if (!reviewKeys.has(itemKey(item))) {
      next.reviewQueue.push(item as ReviewQueueItem)
    }
  }

  next.nextReviewAt = next.scheduledQueue
    .reduce<string | null>((earliest, item) => !earliest || item.card.due < earliest ? item.card.due : earliest, null)
  return next
}

function applyReview(data: DashboardData, operation: Extract<ProgressOperation, { kind: 'review' }>) {
  const key = `${operation.data.itemType}:${operation.data.itemId}`
  const item = [...data.codebookQueue, ...data.reviewQueue].find((candidate) => itemKey(candidate) === key)
  if (!item) return data

  const reviewedAt = new Date(operation.data.reviewedAt)
  const nextCard = scheduler.next(toCard(item.card), reviewedAt, operation.data.rating as Grade).card
  const scheduled = {
    ...item,
    card: toSnapshot(nextCard),
    reps: nextCard.reps,
    srsState: nextCard.state,
  } as ScheduledQueueItem
  const next = structuredClone(data)
  next.reviewQueue = next.reviewQueue.filter((candidate) => itemKey(candidate) !== key)
  next.codebookQueue = next.codebookQueue.filter((candidate) => itemKey(candidate) !== key)
  next.scheduledQueue = [
    ...next.scheduledQueue.filter((candidate) => itemKey(candidate) !== key),
    scheduled,
  ]
  return refreshDueQueues(next, reviewedAt)
}

function applyEnrollment(data: DashboardData, operation: Extract<ProgressOperation, { kind: 'enroll' }>) {
  const key = `${operation.data.itemType}:${operation.data.itemId}`
  const buildItem = data.buildQueue.find((item) => itemKey(item) === key)
  const readingItem = operation.data.itemType === 'sentence'
    ? data.getQueue.find((item) => item.id === operation.data.itemId)
    : undefined
  const source = buildItem ?? readingItem
  if (!source) return data

  const next = structuredClone(data)
  const card = createEmptyCard(new Date(operation.data.enrolledAt))
  next.buildQueue = next.buildQueue.filter((item) => itemKey(item) !== key)
  next.getQueue = next.getQueue.filter((item) => item.id !== operation.data.itemId)
  next.reviewQueue.push({
    ...source,
    type: operation.data.itemType,
    queueKind: 'review',
    srsState: card.state,
    reps: card.reps,
    card: toSnapshot(card),
  } as ReviewQueueItem)

  if (operation.data.itemType === 'character') {
    next.progress.introducedCharacters += 1
    next.progress.introducedCharactersToday += 1
  } else if (operation.data.itemType === 'word') {
    next.progress.introducedWords += 1
    next.progress.introducedWordsToday += 1
  }
  return next
}

function applyMovie(data: DashboardData, operation: Extract<ProgressOperation, { kind: 'movie' }>) {
  const next = structuredClone(data)
  next.buildQueue = next.buildQueue.map((item) => {
    if (item.type !== 'character' || item.id !== operation.data.characterId) return item
    return {
      ...item,
      movie: {
        ...item.movie,
        actorName: operation.data.actorName || item.movie.actorName,
        setName: operation.data.setName || item.movie.setName,
        roomName: operation.data.roomName || item.movie.roomName,
        configured: true,
        components: item.movie.components.map((component) => ({
          ...component,
          propName: operation.data.props.find((prop) => prop.component === component.hanzi)?.propName ?? component.propName,
        })),
      },
    }
  })
  return next
}

function applyOperation(data: DashboardData, operation: ProgressOperation) {
  if (operation.kind === 'review') return applyReview(data, operation)
  if (operation.kind === 'enroll') return applyEnrollment(data, operation)
  if (operation.kind === 'movie') return applyMovie(data, operation)
  if (operation.kind === 'preferences') {
    return { ...structuredClone(data), learner: { ...data.learner, ...operation.data } }
  }
  const next = structuredClone(data)
  next.buildQueue = next.buildQueue.map((item) =>
    item.type === 'word' && item.id === operation.data.wordId
      ? { ...item, livingLink: operation.data.story }
      : item,
  )
  return next
}

function applyLibraryOperation(data: LibraryData, dashboard: DashboardData, operation: ProgressOperation) {
  if (operation.kind !== 'enroll' && operation.kind !== 'review') return data
  if (operation.data.itemType !== 'character' && operation.data.itemType !== 'word') return data
  const collection = operation.data.itemType === 'character' ? 'characters' : 'words'
  const reviewedItem = dashboard.scheduledQueue.find(
    (item) => item.type === operation.data.itemType && item.id === operation.data.itemId,
  )
  const status = reviewedItem?.srsState === State.Review ? 'review' as const : 'learning' as const
  return {
    ...structuredClone(data),
    [collection]: data[collection].map((item) =>
      item.id === operation.data.itemId ? { ...item, status } : item,
    ),
  }
}

function applyPalaceOperation(data: PalaceData, operation: ProgressOperation) {
  if (operation.kind !== 'movie') return data
  const next = structuredClone(data)
  const upsert = (items: Array<{ key: string; name: string }>, key: string, name: string) => {
    if (!name) return items
    return [...items.filter((item) => item.key !== key), { key, name }]
      .sort((left, right) => left.key.localeCompare(right.key))
  }
  next.actors = upsert(next.actors, operation.data.actorKey, operation.data.actorName)
  next.sets = upsert(next.sets, operation.data.finalKey, operation.data.setName)
  next.props = operation.data.props.reduce(
    (items, prop) => upsert(items, prop.component, prop.propName),
    next.props,
  )
  next.rooms = next.rooms.map((room) =>
    room.tone === operation.data.tone && operation.data.roomName
      ? { ...room, name: operation.data.roomName }
      : room,
  )
  return next
}

async function readCache<T>(key: CacheKey) {
  if (!isBrowser()) return null
  const cached = await (await getDatabase()).get('cache', key)
  return cached?.value as T | undefined ?? null
}

async function writeCache(key: CacheKey, value: unknown) {
  if (!isBrowser()) return
  await (await getDatabase()).put('cache', { key, value })
}

export async function persistDashboard(data: DashboardData) {
  if (!isBrowser()) return
  const database = await getDatabase()
  if (await database.count('outbox')) return
  await writeCache('dashboard', data)
}

export async function getOfflineDashboard() {
  if (!isBrowser()) return getDashboard()
  await flushProgress()
  const database = await getDatabase()
  if (!(await database.count('outbox'))) {
    try {
      const data = await getDashboard()
      await writeCache('dashboard', data)
      return data
    } catch {
      // The cached snapshot below is the source of truth while disconnected.
    }
  }
  const cached = await readCache<DashboardData>('dashboard')
  if (!cached) throw new Error('Open Fluenc online once before using it offline')
  const refreshed = refreshDueQueues(cached)
  await writeCache('dashboard', refreshed)
  return refreshed
}

async function getOfflineQuery<T>(key: Exclude<CacheKey, 'dashboard'>, remote: () => Promise<T>) {
  if (!isBrowser()) return remote()
  try {
    const data = await remote()
    await writeCache(key, data)
    return data
  } catch (error) {
    const cached = await readCache<T>(key)
    if (cached) return cached
    throw error
  }
}

export function getOfflineLibrary() {
  return getOfflineQuery<LibraryData>('library', () => getLibrary())
}

export function getOfflinePalace() {
  return getOfflineQuery<PalaceData>('palace', () => getPalace())
}

async function enqueue(operation: ProgressOperation) {
  const database = await getDatabase()
  const transaction = database.transaction(['cache', 'outbox'], 'readwrite')
  const cached = await transaction.objectStore('cache').get('dashboard')
  if (!cached) throw new Error('Open Fluenc online once before saving progress offline')
  const nextDashboard = applyOperation(cached.value as DashboardData, operation)
  await transaction.objectStore('cache').put({
    key: 'dashboard',
    value: nextDashboard,
  })
  const library = await transaction.objectStore('cache').get('library')
  if (library) {
    await transaction.objectStore('cache').put({
      key: 'library',
      value: applyLibraryOperation(library.value as LibraryData, nextDashboard, operation),
    })
  }
  const palace = await transaction.objectStore('cache').get('palace')
  if (palace) {
    await transaction.objectStore('cache').put({
      key: 'palace',
      value: applyPalaceOperation(palace.value as PalaceData, operation),
    })
  }
  await transaction.objectStore('outbox').add(operation)
  await transaction.done
}

async function sendOperation(operation: ProgressOperation) {
  if (operation.kind === 'review') return reviewItem({ data: operation.data })
  if (operation.kind === 'enroll') return enrollItem({ data: operation.data })
  if (operation.kind === 'movie') return saveMovie({ data: operation.data })
  if (operation.kind === 'livingLink') return saveLivingLink({ data: operation.data })
  return savePreferences({ data: operation.data })
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
      await sendOperation(cursor.value)
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

async function saveOperation(operation: ProgressOperation) {
  await enqueue(operation)
  await flushProgress()
}

export function saveEnrollment(data: Omit<EnrollInput, 'enrolledAt'>) {
  return saveOperation({
    kind: 'enroll',
    data: { ...data, enrolledAt: new Date().toISOString() },
  })
}

export function saveLivingLinkOffline(data: LivingLinkInput) {
  return saveOperation({ kind: 'livingLink', data })
}

export function saveMovieOffline(data: MovieInput) {
  return saveOperation({ kind: 'movie', data })
}

export function savePreferencesOffline(data: PreferencesInput) {
  return saveOperation({ kind: 'preferences', data })
}

export function saveReview(data: Omit<ReviewInput, 'eventId' | 'reviewedAt'>) {
  return saveOperation({
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
  const refreshed = refreshDueQueues(cached)
  await writeCache('dashboard', refreshed)
  return refreshed
}

export async function hasPendingProgress() {
  return isBrowser() && (await (await getDatabase()).count('outbox')) > 0
}
