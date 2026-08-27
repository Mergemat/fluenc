import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'

import { savePreferences, type DashboardData } from '../server/curriculum'
import { Button } from './ui/Button'

export function ProfileDialog({ learner, onClose }: { learner: DashboardData['learner']; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState(learner.displayName)
  const [dailyCharacterGoal, setDailyCharacterGoal] = useState(learner.dailyCharacterGoal)
  const [dailyWordGoal, setDailyWordGoal] = useState(learner.dailyWordGoal)
  const saveMutation = useMutation({
    mutationFn: () => savePreferences({ data: { displayName, dailyCharacterGoal, dailyWordGoal } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
  })

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        className="w-full max-w-sm rounded-t-2xl border border-line bg-paper p-5 shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
      >
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-lg font-semibold tracking-tight" id="profile-title">Your pace</h2>
          <Button variant="icon" type="button" onClick={onClose} aria-label="Close"><X size={17} /></Button>
        </header>

        <label className="mt-3.5 grid gap-1.5 text-xs font-semibold text-muted">
          Name
          <input
            className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink focus:border-ink"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            New characters / day
            <input
              className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink focus:border-ink"
              type="number"
              min="1"
              max="20"
              value={dailyCharacterGoal}
              onChange={(event) => setDailyCharacterGoal(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            New words / day
            <input
              className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink focus:border-ink"
              type="number"
              min="1"
              max="30"
              value={dailyWordGoal}
              onChange={(event) => setDailyWordGoal(Number(event.target.value))}
            />
          </label>
        </div>

        {saveMutation.isError ? <p className="mt-3 text-xs text-danger" role="alert">Could not save settings.</p> : null}

        <footer className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!displayName.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </footer>
      </section>
    </div>
  )
}
