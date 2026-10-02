import { X } from 'lucide-react'

import './updates.css'

export function AppUpdateToast({ updating, failed, saving, onRefresh, onDismiss }: {
  updating: boolean
  failed: boolean
  saving: boolean
  onRefresh: () => void
  onDismiss: () => void
}) {
  return <div className="app-update-toast">
    <span role="status">{updating ? 'Refreshing…' : failed ? 'Refresh failed. Try again.' : 'Refresh to update'}</span>
    <button className="app-update-refresh" type="button" disabled={updating || saving} onClick={onRefresh}>Refresh</button>
    <button className="app-update-dismiss" type="button" aria-label="Dismiss update" disabled={updating} onClick={onDismiss}><X size={16} /></button>
  </div>
}
