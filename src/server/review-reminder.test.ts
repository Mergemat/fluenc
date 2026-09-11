import { expect, mock, test } from 'bun:test'
import { handleReviewReminder } from './review-reminder.server'

function setup() {
  const hasDueReviews = mock(async () => true)
  const send = mock(async (_url: URL, _init: RequestInit): Promise<Response> => Response.json({ ok: true, delivered: 1 }))
  return {
    cronSecret: 'test-cron-secret', webhookUrl: 'https://hark.ryan.ceo/hooks/whk_test',
    now: new Date('2026-09-11T11:00:00Z'), hasDueReviews, send,
  }
}

const request = (token = 'test-cron-secret') => new Request('https://fluenc.example/api/review-reminder', {
  headers: { authorization: `Bearer ${token}` },
})

test('unauthenticated and unconfigured reminders never read progress or send a notification', async () => {
  const options = setup()
  expect((await handleReviewReminder(request('wrong'), options)).status).toBe(401)
  expect((await handleReviewReminder(request(), { ...options, cronSecret: undefined })).status).toBe(401)
  expect((await handleReviewReminder(request(), { ...options, webhookUrl: undefined })).status).toBe(503)
  expect(options.hasDueReviews).not.toHaveBeenCalled()
  expect(options.send).not.toHaveBeenCalled()
})

test('completed reviews produce no reminder', async () => {
  const options = setup()
  options.hasDueReviews.mockResolvedValue(false)
  const response = await handleReviewReminder(request(), options)
  expect(await response.json()).toEqual({ status: 'skipped', reason: 'No reviews due' })
  expect(options.send).not.toHaveBeenCalled()
})

test('repeated runs use the same Hark event key and payload, with a new key the next day', async () => {
  const options = setup()
  expect((await handleReviewReminder(request(), options)).status).toBe(200)
  await handleReviewReminder(request(), { ...options, now: new Date('2026-09-11T11:20:00Z') })
  await handleReviewReminder(request(), { ...options, now: new Date('2026-09-12T11:00:00Z') })
  const calls = options.send.mock.calls.map(([, init]) => ({ key: new Headers(init.headers).get('Idempotency-Key'), body: init.body }))
  expect(calls[0]).toEqual(calls[1])
  expect(calls[0]!.key).not.toBe(calls[2]!.key)
  expect(JSON.parse(calls[0]!.body as string).title).toBe('Fluenc')
})

test('invalid endpoints, missing devices, upstream failures, and secret-bearing errors are handled', async () => {
  const options = setup()
  expect((await handleReviewReminder(request(), { ...options, webhookUrl: 'https://another.example/hooks/whk_test' })).status).toBe(503)
  expect(options.send).not.toHaveBeenCalled()
  options.send.mockResolvedValueOnce(Response.json({ ok: true, delivered: 0 }))
  expect((await handleReviewReminder(request(), options)).status).toBe(502)
  options.send.mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
  expect((await handleReviewReminder(request(), options)).status).toBe(502)
  options.send.mockRejectedValueOnce(new Error(`Network failure: ${options.webhookUrl}`))
  const response = await handleReviewReminder(request(), options)
  expect(response.status).toBe(502)
  expect(await response.text()).not.toContain('whk_test')
})
