import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, X } from 'lucide-react'
import { useState } from 'react'

import { savePreferences, type DashboardData } from '../server/curriculum'
import { Button } from './ui/Button'
import { Eyebrow } from './ui/Eyebrow'

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
    <div className="fixed inset-0 z-20 grid place-items-center bg-[rgba(15,25,21,.42)] p-5 backdrop-blur-[5px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="w-[min(470px,100%)] rounded-[18px] bg-paper p-[22px] shadow-[0_30px_90px_rgba(14,27,22,.28)] [&_label]:mt-3.5 [&_label]:grid [&_label]:gap-[7px] [&_label]:text-xs [&_label]:font-semibold [&_label]:text-muted [&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-[10px] [&_input]:border [&_input]:border-line [&_input]:bg-white [&_input]:px-3 [&_input]:text-base [&_input]:text-ink [&_input]:outline-0 [&_input]:focus:border-fluenc-blue" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <header className="mb-[22px] flex justify-between gap-6"><div><Eyebrow>Настройки маршрута</Eyebrow><h2 className="m-0 text-2xl tracking-[-.035em]" id="profile-title">Ваш учебный день</h2></div><Button variant="icon" type="button" onClick={onClose} aria-label="Закрыть"><X size={18} /></Button></header>
        <label><span>Имя</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span>Новых иероглифов</span><input type="number" min="1" max="20" value={dailyCharacterGoal} onChange={(event) => setDailyCharacterGoal(Number(event.target.value))} /></label>
          <label><span>Новых слов</span><input type="number" min="1" max="30" value={dailyWordGoal} onChange={(event) => setDailyWordGoal(Number(event.target.value))} /></label>
        </div>
        {saveMutation.isError ? <p className="text-xs text-fluenc-red" role="alert">Не удалось сохранить настройки.</p> : null}
        <footer className="mt-6 flex justify-end gap-2"><Button variant="secondary" type="button" onClick={onClose}>Отмена</Button><Button type="button" disabled={!displayName.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}><Save size={16} />{saveMutation.isPending ? 'Сохраняю…' : 'Сохранить'}</Button></footer>
      </section>
    </div>
  )
}
