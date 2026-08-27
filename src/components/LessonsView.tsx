import { BookOpenCheck, Layers3 } from 'lucide-react'

import type { DashboardData } from '../server/curriculum'
import { CharacterStudio } from './CharacterStudio'
import { WordStudio } from './WordStudio'
import { ActivityEmpty, ActivityHeader } from './ui/ActivityHeader'

export function LessonsView({ data }: { data: DashboardData }) {
  const lesson = data.buildQueue[0]

  return (
    <main className="min-h-screen">
      <ActivityHeader
        eyebrow="Build"
        title="Уроки"
        detail={lesson ? <><b className="text-base text-ink tabular-nums">{data.buildQueue.length}</b><br />доступно сейчас</> : 'Новых уроков нет'}
      />

      {lesson ? (
        <div className="mx-auto max-w-[900px] px-7 py-8 max-[720px]:px-3.5 max-[720px]:py-5">
          <div className="mb-4 flex items-center justify-between gap-4 text-[10px] font-bold text-muted">
            <span className="inline-flex items-center gap-2 text-jade"><Layers3 size={15} /> Следующий урок</span>
            <span>{lesson.type === 'character' ? 'Иероглиф' : 'Слово'}</span>
          </div>
          {lesson.type === 'character'
            ? <CharacterStudio key={`${lesson.type}:${lesson.id}`} item={lesson} />
            : <WordStudio key={`${lesson.type}:${lesson.id}`} item={lesson} />}
        </div>
      ) : (
        <ActivityEmpty icon={<BookOpenCheck size={20} />}>
          <h2 className="m-0 text-2xl tracking-[-.035em] text-ink">Уроки на сегодня пройдены</h2>
          <p className="m-0 max-w-[440px] text-sm leading-[1.6]">Продолжайте с чтением или измените дневной объём в настройках.</p>
        </ActivityEmpty>
      )}
    </main>
  )
}
