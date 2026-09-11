import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Root } from 'react-dom/client'

import type { BuildItem, DashboardData } from '../server/curriculum'
import { getMovieCoordinates } from '../lib/pinyin'

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

const word: BuildItem = {
  type: 'word', id: '5', hanzi: '我们', pinyin: 'wǒmen', meaning: 'we',
  dictionaryMeanings: [], rank: 5, characterIds: ['我', '们'], livingLink: '', queueKind: 'new',
}

async function show(buildQueue: BuildItem[]) {
  const data: DashboardData = {
    curriculum: { version: 'test', characters: 2, words: 1 },
    progress: { introducedCharacters: 0, introducedWords: 0 },
    reviewQueue: [], scheduledQueue: [], nextReviewAt: null, getQueue: [], buildQueue,
  }
  await act(async () => root.render(<QueryClientProvider client={client}><LessonsView data={data} /></QueryClientProvider>))
}

async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find(button => button.textContent?.includes(text))
  expect(button).toBeDefined()
  await act(async () => button!.click())
}

test('sync unlocks a word without replacing the next character or discarding its draft clues', async () => {
  const first = character('太', 'tài')
  const next = character('了', 'le')
  await show([first, next])
  expect(host.querySelector('.cs-target-hanzi')?.textContent).toBe('太')

  // The local completion publishes the remaining queue before the server sync finishes.
  await show([next])
  expect(host.querySelector('.cs-target-hanzi')?.textContent).toBe('了')
  await click('Fill in clues')
  const input = host.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'My actor')
    input.dispatchEvent(new browser.Event('input', { bubbles: true }) as unknown as Event)
  })
  await click('All clues')
  expect(host.textContent).toContain('My actor')
  await click('Fill in clues')

  // The server adds an unlocked word ahead of the character currently being edited.
  await show([word, { ...next, movie: { ...next.movie, actorName: 'Server actor' } }])
  expect(host.querySelector('.cs-target-hanzi')?.textContent).toBe('了')
  expect(host.querySelector('input')?.value).toBe('My actor')
  expect(host.querySelector('.word-studio')).toBeNull()

  await show([word])
  expect(host.querySelector('.recall-word')?.textContent).toBe('我们')
  await show([])
  expect(host.textContent).toContain('All lessons complete')
  await show([first])
  expect(host.querySelector('.cs-target-hanzi')?.textContent).toBe('太')
})
