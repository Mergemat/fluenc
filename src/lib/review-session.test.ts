import { expect, test } from 'bun:test'
import { partitionReviews } from './review-session'
import type { ReviewItem } from '../server/curriculum'

function item(id: string, due: string): ReviewItem {
  return {
    id, type: 'sentence', hanzi: '你好。', pinyin: 'Nǐ hǎo.', meaning: 'Hi.', queueKind: 'review', srsState: 2, reps: 1,
    card: { due, state: 2, stability: 3, difficulty: 5, elapsedDays: 1, scheduledDays: 3, learningSteps: 0, reps: 1, lapses: 0, lastReview: '2026-09-01T06:00:00.000Z' },
  }
}

test('catch-up starts at seven calendar days overdue in Shanghai, not after 168 hours', () => {
  const queue = [item('seven-days', '2026-09-04T06:00:00.000Z'), item('six-days', '2026-09-04T16:01:00.000Z')]
  const beforeMidnight = partitionReviews(queue, new Date('2026-09-10T15:59:59.000Z'), new Set())
  expect(beforeMidnight.backlog).toHaveLength(0)
  const afterMidnight = partitionReviews(queue, new Date('2026-09-10T16:00:00.000Z'), new Set())
  expect(afterMidnight.backlog.map(item => item.id)).toEqual(['seven-days'])
  expect(afterMidnight.recent.map(item => item.id)).toEqual(['six-days'])
})
