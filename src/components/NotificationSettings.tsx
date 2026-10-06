import { Bell, BellOff, RefreshCw } from 'lucide-react'

import { useNotifications } from '../notifications/useNotifications'
import { DitherButton } from './dither-kit/button'
import { SettingRow, type Tone } from './ui/SettingRow'

export function NotificationSettings() {
  const { status, busy, message, hasSubscription, run, retry } = useNotifications()
  const tone: Tone = busy || status === 'checking' ? 'busy'
    : status === 'on' ? 'ok'
    : status === 'install' ? 'warn'
    : status === 'blocked' || status === 'error' ? 'error' : 'idle'
  const text = busy === 'subscribe' ? 'preparing — keep fluenc open'
    : busy === 'unsubscribe' ? 'turning off…'
    : busy === 'test' ? 'sending test…'
    : message || (status === 'checking' ? 'checking…'
      : status === 'install' ? 'open fluenc from your home screen (share → add to home screen)'
      : status === 'unsupported' ? 'needs iOS 16.4+ or a supported browser'
      : status === 'development' ? 'available in the published app'
      : status === 'unconfigured' ? 'not configured yet'
      : status === 'blocked' ? 'blocked — allow fluenc in system notification settings'
      : status === 'on' ? 'on for this device'
      : status === 'off' ? 'off' : 'could not check')

  return <SettingRow id="notifications-heading" title="Review reminders" note="daily · 14:00 shanghai, may arrive within the hour" tone={tone} status={text}>
    {status === 'off' ? <DitherButton className="dx-tool" color="blue" variant="gradient" disabled={!!busy} onClick={() => void run('subscribe')}><Bell size={13} />enable</DitherButton> : null}
    {hasSubscription ? <DitherButton className="dx-tool" color="red" variant="dotted" disabled={!!busy || status === 'checking'} onClick={() => void run('unsubscribe')}><BellOff size={13} />turn off</DitherButton> : null}
    {status === 'error' || status === 'blocked' || status === 'unconfigured' ? <DitherButton className="dx-tool" color="grey" variant="dotted" disabled={!!busy} onClick={retry}><RefreshCw size={13} />check again</DitherButton> : null}
  </SettingRow>
}
