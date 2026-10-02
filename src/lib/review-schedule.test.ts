import { expect, test } from 'bun:test'
import { createEmptyCard, Rating, State } from 'ts-fsrs'

import { applyOperation, refreshDueQueues } from '../offline/progress-state'
import type { DashboardData } from '../server/curriculum'
import { compareReviewOrder, reviewDueAt, scheduleReview } from './review-schedule'

function fixture(): DashboardData {
  return {
    curriculum: { version: 'test', characters: 0, words: 0 },
    progress: { introducedCharacters: 0, introducedWords: 0 },
    reviewQueue: [], buildQueue: [], lockedWords: [], scheduledQueue: [], nextReviewAt: null,
    getQueue: [{ id: 's01', hanzi: '你好。', pinyin: 'Nǐ hǎo.', meaning: 'Hi.', words: ['你', '好'], coverage: 1, missingWords: [], missingCharacters: [] }],
  }
}

const review = (data: DashboardData, rating: number, reviewedAt: string) => applyOperation(data, {
  kind: 'review', data: { eventId: crypto.randomUUID(), itemType: 'sentence', itemId: 's01', rating, reviewedAt, durationMs: 100 },
})

test('a new card needs spaced recall before graduating, including after an offline reload', () => {
  const enrolled = applyOperation(fixture(), { kind: 'enroll', data: {
    itemType: 'sentence', itemId: 's01', enrolledAt: '2026-09-23T02:00:00.000Z',
  } })
  const first = review(enrolled, Rating.Good, '2026-09-23T02:00:00.000Z')
  expect(first.reviewQueue).toHaveLength(0)
  expect(first.scheduledQueue[0]!.card.state).toBe(State.Learning)
  expect(first.nextReviewAt).toBe('2026-09-23T02:10:00.000Z')

  const restored = JSON.parse(JSON.stringify(first)) as DashboardData
  expect(refreshDueQueues(restored, new Date('2026-09-23T02:09:59.000Z')).reviewQueue).toHaveLength(0)
  const ready = refreshDueQueues(restored, new Date('2026-09-23T02:10:00.000Z'))
  expect(ready.reviewQueue.map(item => item.id)).toEqual(['s01'])
  const graduated = review(ready, Rating.Good, '2026-09-23T02:10:00.000Z')
  expect(graduated.scheduledQueue[0]!.card.state).toBe(State.Review)
  expect(graduated.nextReviewAt).toBe('2026-09-23T16:00:00.000Z')
  expect(refreshDueQueues(graduated, new Date('2026-09-23T15:59:59.000Z')).reviewQueue).toHaveLength(0)
  expect(refreshDueQueues(graduated, new Date('2026-09-23T16:00:00.000Z')).reviewQueue).toHaveLength(1)
})

test('a failed new card waits one minute, then still needs the ten-minute step', () => {
  const now = new Date('2026-09-23T15:59:30.000Z')
  const missed = scheduleReview(createEmptyCard(now), now, Rating.Again)
  expect(missed.due.toISOString()).toBe('2026-09-23T16:00:30.000Z')
  expect(missed.state).toBe(State.Learning)
  const recalled = scheduleReview(missed, missed.due, Rating.Good)
  expect(recalled.due.toISOString()).toBe('2026-09-23T16:10:30.000Z')
  expect(recalled.state).toBe(State.Learning)
})

test('a forgotten established card relearns after a pause; Hard cannot finish a failed recall', () => {
  const now = new Date('2026-09-23T02:00:00.000Z')
  const established = scheduleReview(createEmptyCard(now), now, Rating.Easy)
  const missed = scheduleReview(established, established.due, Rating.Again)
  expect(missed.state).toBe(State.Relearning)
  expect(missed.lapses).toBe(1)
  expect(missed.due.getTime() - established.due.getTime()).toBe(10 * 60_000)

  const hard = scheduleReview(missed, missed.due, Rating.Hard)
  expect(hard.state).toBe(State.Relearning)
  expect(hard.due.getTime()).toBeGreaterThan(missed.due.getTime())
  const recalled = scheduleReview(hard, hard.due, Rating.Good)
  expect(recalled.state).toBe(State.Review)
  expect(recalled.due.getTime()).toBeGreaterThan(hard.due.getTime())
})

test('long-term cards are available throughout their Shanghai review day, including year boundaries', () => {
  for (const due of ['2026-12-31T16:30:00.000Z', '2027-01-01T03:00:00.000Z', '2027-01-01T15:59:59.000Z']) {
    expect(reviewDueAt(new Date(due), State.Review).toISOString()).toBe('2026-12-31T16:00:00.000Z')
  }
  const overdue = applyOperation(fixture(), { kind: 'enroll', data: {
    itemType: 'sentence', itemId: 's01', enrolledAt: '2026-09-01T02:00:00.000Z',
  } })
  expect(refreshDueQueues(overdue, new Date('2026-09-23T02:00:00.000Z')).reviewQueue).toHaveLength(1)
})

test('due learning steps precede established reviews, which precede newly introduced cards', () => {
  const cards = [
    { id: 'new', state: State.New, due: '2026-09-01T00:00:00Z' },
    { id: 'recent', state: State.Review, due: '2026-09-22T16:00:00Z' },
    { id: 'old', state: State.Review, due: '2026-09-02T16:00:00Z' },
    { id: 'learning', state: State.Learning, due: '2026-09-23T02:00:00Z' },
  ]
  expect(cards.sort(compareReviewOrder).map(card => card.id)).toEqual(['learning', 'old', 'recent', 'new'])
})
