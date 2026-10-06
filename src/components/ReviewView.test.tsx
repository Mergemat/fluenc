import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from '@tanstack/react-router'
import type { Root } from 'react-dom/client'
import { Rating } from 'ts-fsrs'

import { applyOperation, refreshDueQueues } from '../offline/progress-state'
import type { DashboardData } from '../server/curriculum'

const browser = new Window()
const globals = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'] as const
const originals = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
const client = new QueryClient()
const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() })
let root: Root
let host: HTMLDivElement
let ReviewView: typeof import('./ReviewView')['ReviewView']

beforeAll(async () => {
  for (const key of globals) Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : key === 'window' ? browser : browser[key],
  })
  const { createRoot } = await import('react-dom/client')
  ;({ ReviewView } = await import('./ReviewView'))
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterAll(async () => {
  await act(async () => root?.unmount())
  client.clear()
  await browser.happyDOM.close()
  for (const key of globals) {
    const original = originals.get(key)
    if (original) Object.defineProperty(globalThis, key, original)
    else Reflect.deleteProperty(globalThis, key)
  }
})

function fixture(count = 1): DashboardData {
  let data: DashboardData = {
    curriculum: { version: 'test', characters: 0, words: 0 },
    progress: { introducedCharacters: 0, introducedWords: 0 },
    reviewQueue: [], buildQueue: [], lockedWords: [], scheduledQueue: [], nextReviewAt: null,
    getQueue: Array.from({ length: count }, (_, index) => ({
      id: `s${index}`, hanzi: '你好。', pinyin: 'Nǐ hǎo.', meaning: `Sentence ${index}`,
      words: ['你', '好'], coverage: 1, missingWords: [], missingCharacters: [],
    })),
  }
  for (const item of data.getQueue) data = applyOperation(data, { kind: 'enroll', data: {
    itemType: 'sentence', itemId: item.id, enrolledAt: '2026-09-01T02:00:00.000Z',
  } })
  return data
}

async function show(data: DashboardData, session: string) {
  await act(async () => root.render(<RouterContextProvider router={router}><QueryClientProvider client={client}>
    <ReviewView key={session} data={data} />
  </QueryClientProvider></RouterContextProvider>))
}

async function reveal() {
  const button = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Reveal answer'))
  expect(button).toBeDefined()
  await act(async () => button!.click())
}

function rate(data: DashboardData, id: string, rating: number, reviewedAt = '2026-09-23T02:00:00.000Z') {
  return applyOperation(data, { kind: 'review', data: {
    eventId: crypto.randomUUID(), itemType: 'sentence', itemId: id, rating, reviewedAt, durationMs: 100,
  } })
}

test('a last missed card waits and returns concealed instead of falsely completing the reviews', async () => {
  let data = fixture()
  await show(data, 'miss')
  await reveal()
  expect(host.querySelector('.sentence-answer')?.closest('[inert]')).toBeNull()
  data = rate(data, 's0', Rating.Again)
  await show(data, 'miss')
  expect(host.textContent).toContain('1 card still needs practice')
  expect(host.textContent).not.toContain('reviews finished')
  expect(host.textContent).not.toContain('learn new characters')
  data = refreshDueQueues(JSON.parse(JSON.stringify(data)), new Date('2026-09-23T02:01:00.000Z'))
  await show(data, 'miss')
  expect(host.querySelector('.sentence-answer')?.closest('[inert]')).not.toBeNull()
  expect(host.textContent).toContain('Reveal answer')
})

test('all overdue cards remain in one session beyond twenty reviews', async () => {
  let data = fixture(26)
  await show(data, 'all-due')
  expect(host.textContent).toContain('26 ready')
  for (let index = 0; index < 20; index += 1) {
    data = rate(data, `s${index}`, Rating.Easy)
    await show(data, 'all-due')
  }
  expect(host.textContent).toContain('6 ready')
  expect(host.textContent).toContain('Sentence 20')
  expect(host.textContent).not.toContain('reviews finished')
  for (let index = 20; index < 26; index += 1) data = rate(data, `s${index}`, Rating.Easy)
  await show(data, 'all-due')
  expect(host.textContent).toContain('reviews finished')
  expect(host.textContent).toContain('learn new characters')
  // Every sentence is already in reviews, so there is nothing new to read.
  expect(data.getQueue).toHaveLength(0)
  expect(host.querySelector('a[href="/reading"]')).toBeNull()
  expect(host.querySelector('.recall-frame')).toBeNull()
})

test('a learning step becoming due does not replace the currently revealed card', async () => {
  let data = rate(fixture(2), 's0', Rating.Again)
  await show(data, 'stable')
  expect(host.textContent).toContain('Sentence 1')
  await reveal()
  data = refreshDueQueues(data, new Date('2026-09-23T02:01:00.000Z'))
  expect(data.reviewQueue.map(item => item.id)).toEqual(['s0', 's1'])
  await show(data, 'stable')
  expect(host.textContent).toContain('Sentence 1')
  expect(host.querySelector('.sentence-answer')?.closest('[inert]')).toBeNull()
  data = rate(data, 's1', Rating.Easy, '2026-09-23T02:01:00.000Z')
  await show(data, 'stable')
  expect(host.textContent).toContain('Sentence 0')
  expect(host.querySelector('.sentence-answer')?.closest('[inert]')).not.toBeNull()
})

test('no introduced material leads to learning rather than an invented review session', async () => {
  await show(fixture(0), 'empty')
  expect(host.textContent).toContain('start with a lesson')
  expect(host.textContent).toContain('start your first lesson')
  expect(host.querySelector('.recall-frame')).toBeNull()
})
