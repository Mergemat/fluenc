import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Root } from 'react-dom/client'

import { applyOperation } from '../offline/progress-state'
import type { DashboardData } from '../server/curriculum'

const browser = new Window()
const globals = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'] as const
const originals = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
const client = new QueryClient()
let root: Root
let host: HTMLDivElement
let ReviewView: typeof import('./ReviewView')['ReviewView']

beforeAll(async () => {
  for (const key of globals) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : key === 'window' ? browser : browser[key],
    })
  }
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

test('the last missed card hides its answer again instead of ending the session', async () => {
  const fixture: DashboardData = {
    curriculum: { version: 'test', characters: 0, words: 0 },
    progress: { introducedCharacters: 0, introducedWords: 0 },
    reviewQueue: [], buildQueue: [], lockedWords: [], scheduledQueue: [], nextReviewAt: null,
    getQueue: [{ id: 's01', hanzi: '你好。', pinyin: 'Nǐ hǎo.', meaning: 'Hi.', words: ['你', '好'], coverage: 1, missingWords: [], missingCharacters: [] }],
  }
  let data = applyOperation(fixture, { kind: 'enroll', data: {
    itemType: 'sentence', itemId: 's01', enrolledAt: '2026-09-11T19:00:00Z',
  } })
  const show = async () => {
    await act(async () => root.render(<QueryClientProvider client={client}><ReviewView data={data} /></QueryClientProvider>))
  }
  await show()
  const reveal = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Reveal answer'))
  expect(reveal).toBeDefined()
  await act(async () => reveal!.click())
  expect(host.querySelector('.sentence-answer')).not.toBeNull()
  data = applyOperation(data, { kind: 'review', data: {
    eventId: crypto.randomUUID(), itemType: 'sentence', itemId: 's01', rating: 1,
    reviewedAt: '2026-09-11T19:01:00Z', durationMs: 100,
  } })
  await show()
  expect(host.querySelector('.sentence-answer')).toBeNull()
  expect(host.textContent).toContain('Reveal answer')
  expect(host.textContent).not.toContain('All caught up')
})

test('recent reviews stay separate while a fixed catch-up batch retains misses and stops at completion', async () => {
  const now = new Date()
  const fixture: DashboardData = {
    curriculum: { version: 'test', characters: 0, words: 0 },
    progress: { introducedCharacters: 0, introducedWords: 0 },
    reviewQueue: [], buildQueue: [], lockedWords: [], scheduledQueue: [], nextReviewAt: null,
    getQueue: Array.from({ length: 26 }, (_, index) => ({
      id: `s${index}`, hanzi: '你好。', pinyin: 'Nǐ hǎo.', meaning: index === 25 ? 'Recent sentence' : `Older sentence ${index}`,
      words: ['你', '好'], coverage: 1, missingWords: [], missingCharacters: [],
    })),
  }
  let data = fixture
  for (const item of fixture.getQueue) {
    data = applyOperation(data, { kind: 'enroll', data: {
      itemType: 'sentence', itemId: item.id,
      enrolledAt: new Date(now.getTime() - (item.id === 's25' ? 1 : 10) * 86_400_000).toISOString(),
    } })
  }
  const show = async () => {
    await act(async () => root.render(<QueryClientProvider client={client}><ReviewView key="catchup" data={data} /></QueryClientProvider>))
  }
  const click = async (label: string) => {
    const button = [...host.querySelectorAll('button')].find(button => button.textContent?.includes(label))
    expect(button).toBeDefined()
    await act(async () => button!.click())
  }
  let time = now.getTime()
  const rate = (id: string, rating: number) => {
    time += 100
    data = applyOperation(data, { kind: 'review', data: {
      eventId: crypto.randomUUID(), itemType: 'sentence', itemId: id, rating,
      reviewedAt: new Date(time).toISOString(), durationMs: 100,
    } })
  }
  await show()
  expect(host.textContent).toContain('Recent sentence')
  expect(host.textContent).toContain('Catch up · 25')
  await click('Catch up · 25')
  expect(host.textContent).toContain('20 left in this batch')
  expect(host.textContent).toContain('Older sentence 0')
  rate('s0', 1)
  await show()
  expect(host.textContent).toContain('Older sentence 1')
  expect(host.textContent).toContain('20 left in this batch')
  await click('Recent · 1')
  expect(host.textContent).toContain('Recent sentence')
  await click('Catch up · 25')
  for (let index = 1; index < 20; index += 1) rate(`s${index}`, 3)
  await show()
  expect(host.textContent).toContain('1 left in this batch')
  expect(host.textContent).toContain('Older sentence 0')
  rate('s0', 3)
  await show()
  expect(host.textContent).toContain('Batch complete')
  expect(host.textContent).toContain('5 older cards remain')
  expect(host.textContent).not.toContain('All caught up')
  await click('Review next 5 cards')
  expect(host.textContent).toContain('5 left in this batch')
  expect(host.textContent).toContain('Older sentence 20')
})

test('extra practice reviews future cards offline, retains misses across tabs, and finishes a fixed batch', async () => {
  const now = new Date()
  let data: DashboardData = {
    curriculum: { version: 'test', characters: 0, words: 0 },
    progress: { introducedCharacters: 0, introducedWords: 0 },
    reviewQueue: [], buildQueue: [], lockedWords: [], scheduledQueue: [], nextReviewAt: null,
    getQueue: ['oldest', 'newer'].map(id => ({
      id, hanzi: '你好。', pinyin: 'Nǐ hǎo.', meaning: id,
      words: ['你', '好'], coverage: 1, missingWords: [], missingCharacters: [],
    })),
  }
  for (const [index, id] of ['oldest', 'newer'].entries()) {
    const reviewedAt = new Date(now.getTime() - (2 - index) * 3_600_000).toISOString()
    data = applyOperation(data, { kind: 'enroll', data: { itemType: 'sentence', itemId: id, enrolledAt: reviewedAt } })
    data = applyOperation(data, { kind: 'review', data: {
      eventId: crypto.randomUUID(), itemType: 'sentence', itemId: id, rating: 4, reviewedAt, durationMs: 100,
    } })
  }
  expect(data.reviewQueue).toHaveLength(0)
  expect(data.scheduledQueue).toHaveLength(2)
  const show = async () => {
    await act(async () => root.render(<QueryClientProvider client={client}><ReviewView key="extra" data={data} /></QueryClientProvider>))
  }
  const click = async (label: string) => {
    const button = [...host.querySelectorAll('button')].find(button => button.textContent?.includes(label))
    expect(button).toBeDefined()
    await act(async () => button!.click())
  }
  let time = now.getTime()
  const rate = (id: string, rating: number) => {
    time += 1000
    data = applyOperation(data, { kind: 'review', data: {
      eventId: crypto.randomUUID(), itemType: 'sentence', itemId: id, rating,
      reviewedAt: new Date(time).toISOString(), durationMs: 100,
    } })
    data = JSON.parse(JSON.stringify(data))
  }
  await show()
  expect(host.textContent).toContain('All caught up')
  await click('Extra practice')
  expect(host.textContent).toContain('2 left in this batch')
  expect(host.textContent).toContain('oldest')
  await click('Reveal answer')
  rate('oldest', 1)
  await show()
  expect(data.reviewQueue.map(item => item.id)).toEqual(['oldest'])
  expect(host.textContent).toContain('newer')
  expect(host.querySelector('.sentence-answer')).toBeNull()
  await click('Recent · 1')
  await click('Extra practice')
  expect(host.textContent).toContain('newer')
  rate('newer', 3)
  await show()
  expect(host.textContent).toContain('1 left in this batch')
  expect(host.textContent).toContain('oldest')
  rate('oldest', 4)
  await show()
  expect(data.reviewQueue).toHaveLength(0)
  expect(data.scheduledQueue.find(item => item.id === 'oldest')?.reps).toBe(3)
  expect(data.scheduledQueue.find(item => item.id === 'oldest')?.card.lapses).toBe(1)
  expect(host.textContent).toContain('Practice complete')
  expect(host.textContent).not.toContain('Reveal answer')
  await click('Practise 2 more cards')
  expect(host.textContent).toContain('2 left in this batch')
  expect(host.textContent).toContain('newer')
})
