import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { Check, Download, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { flushProgress, hasPendingProgress } from '../offline/progress'
import { dashboardQueryOptions, libraryQueryOptions, palaceQueryOptions } from '../offline/queries'
import type { OfflineDownload } from '../offline/useOfflineDownload'
import { Button } from './ui/Button'
import { Page, PageHeader } from './ui/Layout'
import { NotificationSettings } from './NotificationSettings'
import { useAppUpdate } from '../updates/AppUpdateProvider'

type SyncStatus = 'idle' | 'syncing' | 'done' | 'offline' | 'error'

export function SettingsView({ offline }: { offline: OfflineDownload }) {
  const queryClient = useQueryClient()
  const saving = useIsMutating() > 0
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const update = useAppUpdate()
  const { status, progress, download } = offline
  const downloading = status === 'downloading' || status === 'checking'
  const unavailable = status === 'unsupported' || status === 'development'
  const percentage = progress?.total ? Math.floor(progress.completed / progress.total * 100) : null

  const sync = async () => {
    if (!navigator.onLine) {
      setSyncStatus('offline')
      return
    }
    setSyncStatus('syncing')
    try {
      await flushProgress()
      if (await hasPendingProgress()) throw new Error('Progress is waiting to sync')
      await Promise.all([
        queryClient.invalidateQueries(dashboardQueryOptions),
        queryClient.invalidateQueries(libraryQueryOptions),
        queryClient.invalidateQueries(palaceQueryOptions),
      ])
      setSyncStatus('done')
    } catch {
      setSyncStatus('error')
    }
  }

  return <Page>
    <PageHeader title="Settings" meta={<Button variant="ghost" disabled={saving} onClick={() => {
      if (!queryClient.isMutating()) window.location.reload()
    }}><RefreshCw size={16} />Refresh app</Button>} />
    <div className="settings-sections">
      <NotificationSettings />
      <section className="settings-section" aria-labelledby="updates-heading">
        <div className="settings-copy">
          <h2 id="updates-heading">App updates</h2>
          <p>New versions are checked automatically when you open the app.</p>
        </div>
        <p className="settings-state" role="status">
          {update.status === 'development' ? 'Updates are available in the published app.'
            : update.status === 'unsupported' ? 'This browser does not support app updates.'
              : update.status === 'applying' ? 'Applying update…'
                : update.available ? 'Refresh to use the latest version.'
                  : update.status === 'checking' ? 'Checking for updates…'
                    : update.status === 'error' ? 'Could not check for updates. Connect to the internet and try again.'
                      : 'You’re up to date.'}
        </p>
        <Button variant="secondary" disabled={update.status === 'checking' || update.status === 'applying' || update.status === 'unsupported' || update.status === 'development'} onClick={() => void update.check()}>
          <RefreshCw size={16} />{update.available ? 'Refresh to update' : 'Check for updates'}
        </Button>
      </section>
      <section className="settings-section" aria-labelledby="offline-heading">
        <div className="settings-copy">
          <h2 id="offline-heading">Offline practice</h2>
          <p>Save lessons and all character recordings on this device.</p>
        </div>
        <div className="settings-download">
          {downloading ? <>
            <div className="settings-progress-label" role="status"><span>{percentage === 100 ? 'Finishing download…' : 'Downloading…'}</span><span>{percentage === null ? '' : `${percentage}%`}</span></div>
            <progress className="settings-progress" aria-label="Offline download" max={100} value={percentage ?? undefined} />
          </> : <p className="settings-state" role="status">
            {status === 'ready' ? <><Check size={16} /> Saved on this device</>
              : status === 'error' ? 'Download interrupted. Connect to the internet and try again.'
                : status === 'unsupported' ? 'This browser does not support offline storage.'
                  : status === 'development' ? 'Downloads are available in the published app.'
                    : 'Not downloaded yet'}
          </p>}
          <Button variant="secondary" disabled={downloading || unavailable} onClick={download}>
            {status === 'ready' ? <RefreshCw size={16} /> : <Download size={16} />}
            {status === 'ready' ? 'Download again' : status === 'error' ? 'Retry download' : downloading ? 'Downloading…' : 'Download for offline use'}
          </Button>
        </div>
        <p className="settings-note">Generated word and sentence audio needs internet. Stroke drawings save as you view them.</p>
      </section>
      <section className="settings-section" aria-labelledby="sync-heading">
        <div className="settings-copy">
          <h2 id="sync-heading">Practice progress</h2>
          <p>Your reviews save on this device and sync automatically when you’re online.</p>
        </div>
        <Button variant="secondary" disabled={syncStatus === 'syncing'} onClick={() => void sync()}><RefreshCw size={16} />{syncStatus === 'syncing' ? 'Syncing…' : 'Sync now'}</Button>
        {syncStatus !== 'idle' && syncStatus !== 'syncing' ? <p className="settings-state" role="status">
          {syncStatus === 'done' ? <><Check size={16} /> Progress synced</>
            : syncStatus === 'offline' ? 'You’re offline. Your progress will sync when you reconnect.'
              : 'Could not sync. Your progress is saved here. Try again when connected.'}
        </p> : null}
      </section>
    </div>
  </Page>
}
