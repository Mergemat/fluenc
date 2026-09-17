import { expect, test } from 'bun:test'
import { createEmptyCard, Rating, State } from 'ts-fsrs'

import { applyOperation, refreshDueQueues } from '../offline/progress-state'
import type { DashboardData } from '../server/curriculum'
import { reviewDueAt, scheduleReview } from './review-schedule'

function fixture(): DashboardData {
  return {
    curriculum: { version: 'test', characters: 0, words: 0 },
    progress: { introducedCharacters: 0, introducedWords: 0 },
    reviewQueue: [], buildQueue: [], lockedWords: [], scheduledQueue: [], nextReviewAt: null,
    getQueue: ['s01', 's02', 's03'].map(id => ({ id, hanzi: '你好。', pinyin: 'Nǐ hǎo.', meaning: 'Hi.', words: ['你', '好'], coverage: 1, missingWords: [], missingCharacters: [] })),
  }
}

test('missed cards move behind all other cards and cycle until every answer is remembered', () => {
  let data = fixture()
  for (const item of data.getQueue) {
    data = applyOperation(data, { kind: 'enroll', data: { itemType: 'sentence', itemId: item.id, enrolledAt: '2026-09-11T14:00:00.000Z' } })
  }
  let time = Date.parse('2026-09-11T14:01:00.000Z')
  const rate = (rating: Rating.Again | Rating.Good) => {
    time += 1_000
    data = applyOperation(data, { kind: 'review', data: {
      eventId: crypto.randomUUID(), itemType: 'sentence', itemId: data.reviewQueue[0]!.id,
      rating, reviewedAt: new Date(time).toISOString(), durationMs: 100,
    } })
    // Restoring a serialized snapshot must preserve the unfinished session.
    data = refreshDueQueues(JSON.parse(JSON.stringify(data)), new Date(time))
    return data.reviewQueue.map(item => item.id)
  }
  expect(rate(Rating.Again)).toEqual(['s02', 's03', 's01'])
  expect(rate(Rating.Again)).toEqual(['s03', 's01', 's02'])
  expect(rate(Rating.Good)).toEqual(['s01', 's02'])
  expect(rate(Rating.Again)).toEqual(['s02', 's01'])
  expect(rate(Rating.Good)).toEqual(['s01'])
  expect(rate(Rating.Again)).toEqual(['s01'])
  expect(rate(Rating.Good)).toEqual([])
  expect(data.scheduledQueue).toHaveLength(3)
  expect(data.scheduledQueue.every(item => item.card.due.endsWith('T06:00:00.000Z'))).toBe(true)
})

test('reviews on the same Shanghai date join one batch regardless of time', () => {
  const lastReview = new Date('2026-09-10T13:00:00.000Z')
  for (const due of ['2026-09-10T16:30:00.000Z', '2026-09-11T03:00:00.000Z', '2026-09-11T15:59:59.000Z']) {
    expect(reviewDueAt(new Date(due), lastReview, State.Review).toISOString()).toBe('2026-09-11T06:00:00.000Z')
  }
})

test('a daily batch never reopens on the day of the last review, even across a year boundary', () => {
  expect(reviewDueAt(new Date('2026-12-31T15:40:00.000Z'), new Date('2026-12-31T15:30:00.000Z'), State.Review).toISOString())
    .toBe('2027-01-01T06:00:00.000Z')
})

test('remembered cards retain different intervals but return at 14:00 on a later day', () => {
  const now = new Date('2026-09-11T14:00:00.000Z')
  const results = ([Rating.Hard, Rating.Good, Rating.Easy] as const)
    .map(rating => scheduleReview(createEmptyCard(now), now, rating))
  for (const result of results) {
    expect(result.due.getTime()).toBeGreaterThan(now.getTime())
    expect(result.due.toISOString().slice(11)).toBe('06:00:00.000Z')
  }
  expect(results[0]!.due.getTime()).toBeLessThan(results[2]!.due.getTime())
})

test('forgotten new and established cards repeat immediately, then any passing grade finishes them', () => {
  const now = new Date('2026-09-11T14:00:00.000Z')
  const established = scheduleReview(createEmptyCard(now), now, Rating.Easy)
  for (const card of [createEmptyCard(now), established]) {
    const reviewedAt = card === established ? established.due : now
    const forgotten = scheduleReview(card, reviewedAt, Rating.Again)
    expect(forgotten.due).toEqual(reviewedAt)
    expect(reviewDueAt(forgotten.due, forgotten.last_review, forgotten.state)).toEqual(forgotten.due)
    for (const rating of [Rating.Hard, Rating.Good, Rating.Easy] as const) {
      const remembered = scheduleReview(forgotten, forgotten.due, rating)
      expect(remembered.state).toBe(State.Review)
      expect(remembered.due.getTime()).toBeGreaterThan(forgotten.due.getTime())
      expect(remembered.due.toISOString().slice(11)).toBe('06:00:00.000Z')
    }
  }
})

test('offline cards stay out of review until the batch opens, then remain overdue', () => {
  const enrolled = applyOperation(fixture(), { kind: 'enroll', data: {
    itemType: 'sentence', itemId: 's01', enrolledAt: '2026-09-11T14:00:00.000Z',
  } })
  expect(enrolled.reviewQueue).toHaveLength(1)
  const rated = applyOperation(enrolled, { kind: 'review', data: {
    eventId: crypto.randomUUID(), itemType: 'sentence', itemId: 's01', rating: Rating.Good,
    reviewedAt: '2026-09-11T14:01:00.000Z', durationMs: 100,
  } })
  expect(rated.nextReviewAt).toBe('2026-09-12T06:00:00.000Z')
  expect(refreshDueQueues(rated, new Date('2026-09-12T05:59:59.000Z')).reviewQueue).toHaveLength(0)
  const open = refreshDueQueues(rated, new Date('2026-09-12T06:00:00.000Z'))
  expect(open.reviewQueue.map(item => item.id)).toEqual(['s01'])
  expect(open.scheduledQueue).toHaveLength(0)
  expect(open.nextReviewAt).toBeNull()
  expect(refreshDueQueues(open, new Date('2026-09-14T04:00:00.000Z')).reviewQueue).toHaveLength(1)
})
