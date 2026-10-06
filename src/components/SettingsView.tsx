import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

import { hasPendingProgress } from '../offline/progress'
import type { OfflineDownload } from '../offline/useOfflineDownload'
import { useAppUpdate } from '../updates/AppUpdateProvider'
import { DitherButton } from './dither-kit/button'
import { DitherGradient } from './dither-kit/gradient'
import { NotificationSettings } from './NotificationSettings'
import { Page, PageHeader } from './ui/Layout'
import { SettingRow, type Tone } from './ui/SettingRow'

/**
 * Reminders are the only real choice. Everything else — offline download, progress sync,
 * app updates — runs by itself, so this page only reports how the device is doing.
 */
export function SettingsView({ offline }: { offline: OfflineDownload }) {
  const update = useAppUpdate()
  const pending = useQuery({ queryKey: ['pending-progress'], queryFn: hasPendingProgress, refetchInterval: 3_000, networkMode: 'always' })
  const percentage = offline.progress?.total ? Math.floor(offline.progress.completed / offline.progress.total * 100) : null

  const offlineState: [Tone, string] = offline.status === 'ready' ? ['ok', 'saved on this device']
    : offline.status === 'downloading' || offline.status === 'checking' ? ['busy', percentage === null ? 'downloading…' : `downloading · ${percentage}%`]
    : offline.status === 'idle' ? ['warn', 'downloads when you’re back online']
    : offline.status === 'error' ? ['error', 'interrupted · retries when online']
    : offline.status === 'development' ? ['idle', 'published app only']
    : ['idle', 'not supported in this browser']
  const syncState: [Tone, string] = pending.data ? ['busy', 'changes waiting to sync'] : pending.isPending ? ['busy', 'checking…'] : ['ok', 'all progress synced']
  const updateState: [Tone, string] = update.available ? ['warn', 'new version ready']
    : update.status === 'applying' ? ['busy', 'updating…']
    : update.status === 'error' ? ['error', 'could not check · retries on open']
    : update.status === 'development' || update.status === 'unsupported' ? ['idle', 'published app only']
    : update.status === 'checking' ? ['busy', 'checking…'] : ['ok', 'up to date']

  return <Page>
    <PageHeader title="Settings" />
    <div className="dx-set">
      <NotificationSettings />
      <h3 className="dx-set-group">this device</h3>
      <SettingRow id="offline-heading" title="Offline" note="lessons, strokes and character audio" tone={offlineState[0]} status={offlineState[1]}>
        {offline.status === 'downloading' && percentage !== null ? <span className="dx-set-meter" aria-hidden="true">
          <span style={{ width: `${percentage}%` }}><DitherGradient from="blue" direction="left" cell={2} /></span>
        </span> : null}
      </SettingRow>
      <SettingRow id="sync-heading" title="Progress" note="saved here first, synced in the background" tone={syncState[0]} status={syncState[1]} />
      <SettingRow id="update-heading" title="Version" note="checked each time you open fluenc" tone={updateState[0]} status={updateState[1]}>
        {update.available ? <DitherButton className="dx-tool" color="blue" variant="gradient" disabled={update.status === 'applying'} onClick={update.apply}><RefreshCw size={13} />refresh</DitherButton> : null}
      </SettingRow>
    </div>
  </Page>
}
