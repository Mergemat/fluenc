import { BookOpen } from 'lucide-react'

import type { DashboardData } from '../server/curriculum'
import { ReadingLesson } from './ReadingLesson'
import { ActivityEmpty, ActivityHeader } from './ui/ActivityHeader'

export function ReadingView({ data }: { data: DashboardData }) {
  const sentence = data.getQueue[0]

  return (
    <main className="min-h-screen">
      <ActivityHeader
        eyebrow="Get"
        title="Чтение"
        detail={sentence ? <><b className="text-base text-ink tabular-nums">{data.getQueue.length}</b><br />понятных фраз</> : 'Материалов пока нет'}
      />

      {sentence ? <ReadingLesson key={sentence.id} item={sentence} /> : (
        <ActivityEmpty icon={<BookOpen size={20} />}>
          <h2 className="m-0 text-2xl tracking-[-.035em] text-ink">Пока нечего читать</h2>
          <p className="m-0 max-w-[440px] text-sm leading-[1.6]">Новые фразы откроются, когда вы изучите достаточно входящих в них иероглифов и слов.</p>
        </ActivityEmpty>
      )}
    </main>
  )
}
