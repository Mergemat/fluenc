import { useEffect, useRef } from 'react'

import { Button } from '../components/ui/Button'
import './updates.css'

export function AppUpdatePrompt({ status, saving, onUpdate, onDismiss }: {
  status: string
  saving: boolean
  onUpdate: () => void
  onDismiss: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const updating = status === 'applying'
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])

  return <dialog ref={dialog} className="app-update-dialog" aria-labelledby="app-update-title" aria-describedby="app-update-description" onCancel={event => {
    event.preventDefault()
    if (!updating) onDismiss()
  }}>
    <h2 id="app-update-title">Update available</h2>
    <p id="app-update-description">A new version of Fluenc is ready. Update now to reload the app. Your saved practice progress will stay on this device.</p>
    {saving ? <p role="status">Saving your progress…</p> : null}
    {status === 'error' ? <p role="alert">Could not apply the update. Try again.</p> : null}
    <div className="app-update-actions">
      <Button variant="secondary" type="button" disabled={updating} onClick={onDismiss}>Later</Button>
      <Button type="button" disabled={updating || saving} onClick={onUpdate}>{updating ? 'Updating…' : 'Update now'}</Button>
    </div>
  </dialog>
}
