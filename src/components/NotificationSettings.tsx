import { Bell, BellOff } from 'lucide-react'

import { useNotifications } from '../notifications/useNotifications'
import { Button } from './ui/Button'

export function NotificationSettings() {
  const { status, busy, message, hasSubscription, run, retry } = useNotifications()
  return <section className="settings-section" aria-labelledby="notifications-heading">
    <div className="settings-copy">
      <h2 id="notifications-heading">Review reminders</h2>
      <p>A daily notification when reviews are due. Tap it to open Review in Fluenc.</p>
    </div>
    <p className="settings-state" role="status">
      {busy === 'subscribe' ? 'Preparing notifications. Keep Fluenc open…'
        : busy === 'unsubscribe' ? 'Turning off…'
          : busy === 'test' ? 'Sending test…'
            : message || (status === 'checking' ? 'Checking notifications…'
              : status === 'install' ? 'Open Fluenc from your Home Screen to enable notifications. If needed, use Share → Add to Home Screen first.'
                : status === 'unsupported' ? 'Notifications need a supported browser. On iPhone, use iOS 16.4 or later.'
                  : status === 'development' ? 'Notifications are available in the published app.'
                    : status === 'unconfigured' ? 'Notifications are not configured yet.'
                      : status === 'blocked' ? 'Notifications are blocked. Allow them for Fluenc in your device’s notification settings, then reopen the app.'
                        : status === 'on' ? 'Enabled on this device'
                          : status === 'off' ? 'Off on this device' : 'Could not check notifications.')}
    </p>
    {status === 'off' ? <Button variant="secondary" disabled={!!busy} onClick={() => void run('subscribe')}><Bell size={16} />Enable notifications</Button> : null}
    {status === 'on' ? <Button variant="secondary" disabled={!!busy} onClick={() => void run('test')}><Bell size={16} />Send test notification</Button> : null}
    {hasSubscription ? <Button variant="ghost" disabled={!!busy || status === 'checking'} onClick={() => void run('unsubscribe')}><BellOff size={16} />Turn off notifications</Button> : null}
    {status === 'error' || status === 'blocked' || status === 'unconfigured' ? <Button variant="secondary" disabled={!!busy} onClick={retry}>Check again</Button> : null}
    <p className="settings-note">Scheduled for 14:00 Shanghai time; delivery may arrive within the following hour. Only synced progress is checked.</p>
  </section>
}
