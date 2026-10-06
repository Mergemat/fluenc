import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Root } from 'react-dom/client'

import { deriveDashboard, type BuildItem, type DashboardData } from '../lib/learner-views'
import { getMovieCoordinates } from '../lib/pinyin'
import { applyOperation, emptyLearnerState } from '../lib/learner-state'

const browser = new Window()
const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'IS_REACT_ACT_ENVIRONMENT'] as const
const originals = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
let root: Root
let LessonsView: typeof import('./LessonsView')['LessonsView']
let host: HTMLDivElement
const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })

beforeAll(async () => {
  for (const key of globals) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : key === 'window' ? browser : browser[key],
    })
  }
  const { createRoot } = await import('react-dom/client')
  ;({ LessonsView } = await import('./LessonsView'))
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterAll(async () => {
  await act(async () => root?.unmount())
  client.clear()
  await browser.happyDOM.close()
  for (const key of globals) {
    const descriptor = originals.get(key)
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

function character(id: string, pinyin: string): Extract<BuildItem, { type: 'character' }> {
  return {
    type: 'character', id, hanzi: id, pinyin, keyword: id, dictionaryMeanings: [],
    rank: 1, unlocks: 1, queueKind: 'new',
    movie: {
      ...getMovieCoordinates(pinyin), actorName: '', setName: '', roomName: 'Rooftop',
      isPrimitive: false, componentNote: null, components: [], configured: false,
    },
  }
}

const word: Extract<BuildItem, { type: 'word' }> = {
  type: 'word', id: '5', hanzi: '我们', pinyin: 'wǒmen', meaning: 'we',
  dictionaryMeanings: [], rank: 5, characterIds: ['我', '们'], syllables: ['wǒ', 'men'], livingLink: '', queueKind: 'new',
  characterParts: [{ hanzi: '我', meaning: 'I' }, { hanzi: '们', meaning: 'plural marker' }],
}

async function show(buildQueue: BuildItem[], lockedWords: DashboardData['lockedWords'] = []) {
  const data: DashboardData = {
    curriculum: { version: 'test', characters: 2, words: 1 },
    progress: { introducedCharacters: 0, introducedWords: 0 },
    reviewQueue: [], scheduledQueue: [], nextReviewAt: null, getQueue: [], lockedWords, buildQueue,
  }
  await act(async () => root.render(<QueryClientProvider client={client}><LessonsView data={data} /></QueryClientProvider>))
  return data
}

test('sync unlocks a word without replacing the next character or discarding its draft clues', async () => {
  const first = character('太', 'tài')
  const next = character('了', 'le')
  await show([first, next])
  expect(host.querySelector('.dx-glyph-ghost')?.textContent).toBe('太')

  // The local completion publishes the remaining queue before the server sync finishes.
  await show([next])
  expect(host.querySelector('.dx-glyph-ghost')?.textContent).toBe('了')
  // Clues are named inline; the first slot is the actor.
  const input = host.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'My actor')
    input.dispatchEvent(new browser.Event('input', { bubbles: true }) as unknown as Event)
  })
  expect(host.querySelector('input')?.value).toBe('My actor')

  // The server adds an unlocked word ahead of the character currently being edited.
  await show([word, { ...next, movie: { ...next.movie, actorName: 'Server actor' } }])
  expect(host.querySelector('.dx-glyph-ghost')?.textContent).toBe('了')
  expect(host.querySelector('input')?.value).toBe('My actor')
  expect(host.querySelector('.dx-word-lesson')).toBeNull()

  await show([word])
  expect(host.querySelector('.dx-word-lesson')?.getAttribute('data-hanzi')).toBe('我们')
  await show([])
  expect(host.textContent).toContain('All lessons complete')
  await show([first])
  expect(host.querySelector('.dx-glyph-ghost')?.textContent).toBe('太')
})

test('learning the final prerequisite opens a word immediately without a server refresh', async () => {
  await show([])
  let state = emptyLearnerState
  const enroll = (itemType: 'character' | 'word', itemId: string) => {
    state = applyOperation(state, { kind: 'enroll', data: { itemType, itemId, enrolledAt: new Date().toISOString() } })
    return deriveDashboard(state, new Date())
  }

  let data = enroll('character', '我')
  await show(data.buildQueue, data.lockedWords)
  expect(host.querySelector('.dx-glyph-ghost')?.textContent).toBe('们')
  expect(data.lockedWords.map(item => item.hanzi)).toContain('我们')

  data = enroll('character', '们')
  await show(data.buildQueue, data.lockedWords)
  expect(host.querySelector('.dx-word-lesson')?.getAttribute('data-hanzi')).toBe('我们')
  expect(data.lockedWords.map(item => item.hanzi)).not.toContain('我们')

  const wordId = data.buildQueue[0]!.id
  data = enroll('word', wordId)
  await show(data.buildQueue, data.lockedWords)
  expect(host.querySelector('.dx-word-lesson')).toBeNull()
  expect(host.querySelector('.dx-glyph-ghost')?.textContent).toBe(data.buildQueue[0]!.hanzi)
  expect(data.reviewQueue.filter(item => item.type === 'word' && item.id === wordId)).toHaveLength(1)
})
