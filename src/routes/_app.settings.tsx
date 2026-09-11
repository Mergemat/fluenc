import { createFileRoute } from '@tanstack/react-router'

import { SettingsView } from '../components/SettingsView'
import { useAppOfflineDownload } from '../offline/OfflineDownloadProvider'

export const Route = createFileRoute('/_app/settings')({ component: Settings })

function Settings() {
  const offline = useAppOfflineDownload()
  return <SettingsView offline={offline} />
}
