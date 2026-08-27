import { useMutation, useQueryClient } from '@tanstack/react-query'
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
      className="fixed inset-0 z-20 flex items-end justify-center bg-ink/30 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        className="w-full max-w-sm bg-paper px-6 pb-10 pt-6 sm:rounded-3xl sm:pb-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
      >
        <h2 className="m-0 mb-7 text-[11px] font-semibold uppercase tracking-[.16em] text-faint" id="profile-title">Your pace</h2>

        <label className="grid gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-faint">Name</span>
          <input
            className="h-11 w-full border-0 border-b border-line bg-transparent text-[15px] font-medium focus:border-ink"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <div className="mt-6 grid grid-cols-2 gap-6">
          <label className="grid gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-faint">Characters / day</span>
            <input
              className="h-11 w-full border-0 border-b border-line bg-transparent text-[15px] font-medium focus:border-ink"
              type="number"
              min="1"
              max="20"
              value={dailyCharacterGoal}
              onChange={(event) => setDailyCharacterGoal(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-faint">Words / day</span>
            <input
              className="h-11 w-full border-0 border-b border-line bg-transparent text-[15px] font-medium focus:border-ink"
              type="number"
              min="1"
              max="30"
              value={dailyWordGoal}
              onChange={(event) => setDailyWordGoal(Number(event.target.value))}
            />
          </label>
        </div>

        {saveMutation.isError ? <p className="mt-3 mb-0 text-xs text-danger" role="alert">Could not save settings.</p> : null}

        <footer className="mt-9">
          <Button type="button" disabled={!displayName.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          <div className="mt-2 grid justify-items-center">
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          </div>
        </footer>
      </section>
    </div>
  )
}
