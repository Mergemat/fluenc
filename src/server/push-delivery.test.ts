import { expect, spyOn, test } from 'bun:test'
import { randomBytes } from 'node:crypto'
import webpush from 'web-push'

import { sendPush } from './push-delivery.server'

test('daily and test pushes have stable, distinct topics that a push provider can decode', async () => {
  const keys = webpush.generateVAPIDKeys()
  const environment = {
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: 'https://fluenc.example',
  }
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]))
  Object.assign(process.env, environment)
  const subscription = {
    endpoint: 'https://web.push.apple.com/test',
    keys: { p256dh: webpush.generateVAPIDKeys().publicKey, auth: randomBytes(16).toString('base64url') },
  }
  const topics: string[] = []
  const send = spyOn(webpush, 'sendNotification').mockImplementation(async (device, payload, options) => {
    const request = webpush.generateRequestDetails(device, payload ?? undefined, options)
    const topic = String(request.headers.Topic)
    expect(topic).toMatch(/^[A-Za-z0-9_-]{1,32}$/)
    // The library checks the alphabet only. Apple rejected the old 13-character
    // daily topic with BadWebPushTopic because it was not decodable base64url.
    expect(() => atob(topic.replaceAll('-', '+').replaceAll('_', '/'))).not.toThrow()
    expect(request.body?.length).toBeGreaterThan(0)
    topics.push(topic)
    return { statusCode: 201, body: '', headers: {} }
  })
  try {
    await sendPush(subscription)
    await sendPush(subscription, true)
    await sendPush(subscription)
    expect(topics[0]).toBe(topics[2])
    expect(topics[0]).not.toBe(topics[1])
  } finally {
    send.mockRestore()
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
