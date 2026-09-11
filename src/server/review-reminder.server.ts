import { reviewDay } from '../lib/review-schedule'

type ReminderOptions = {
  cronSecret: string | undefined
  webhookUrl: string | undefined
  hasDueReviews: () => Promise<boolean>
  send?: (url: URL, init: RequestInit) => Promise<Response>
  now?: Date
}

export async function handleReviewReminder(request: Request, options: ReminderOptions) {
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!options.cronSecret || request.headers.get('authorization') !== `Bearer ${options.cronSecret}`) {
    return json({ error: 'Unauthorized' }, 401)
  }
  if (!options.webhookUrl) return json({ error: 'Hark is not configured' }, 503)

  let webhook: URL
  try {
    webhook = new URL(options.webhookUrl)
    if (webhook.origin !== 'https://hark.ryan.ceo' || !/^\/hooks\/whk_[A-Za-z0-9_-]+$/.test(webhook.pathname) || webhook.username || webhook.password || webhook.search || webhook.hash) {
      return json({ error: 'Invalid Hark webhook configuration' }, 503)
    }
  } catch {
    return json({ error: 'Invalid Hark webhook configuration' }, 503)
  }

  try {
    if (!await options.hasDueReviews()) return json({ status: 'skipped', reason: 'No reviews due' })
    const response = await (options.send ?? fetch)(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `fluenc-review-${reviewDay(options.now ?? new Date())}`,
      },
      // Keep the payload stable so a retried daily job cannot create another push.
      // The Hark service supplies the avatar and destination URL.
      body: JSON.stringify({ title: 'Fluenc', body: 'Your Mandarin reviews are ready. Start with recent cards, then catch up at your pace.' }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    })
    if (response.status === 202) return json({ status: 'pending' }, 202)
    if (!response.ok) return json({ error: 'Hark rejected the reminder', status: response.status }, 502)
    const result = await response.json() as { ok?: boolean; delivered?: number }
    if (!result.ok || typeof result.delivered !== 'number' || result.delivered < 1) {
      return json({ error: 'No device accepted the reminder. Check the Hark service and iPhone registration.' }, 502)
    }
    return json({ status: 'accepted', devices: result.delivered })
  } catch {
    // Fetch errors can contain the secret webhook URL; never return or log them.
    return json({ error: 'Could not send the review reminder' }, 502)
  }
}
