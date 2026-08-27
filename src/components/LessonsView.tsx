import { BookOpenCheck, Layers3 } from 'lucide-react'

import type { DashboardData } from '../server/curriculum'
import { CharacterStudio } from './CharacterStudio'
import { WordStudio } from './WordStudio'
import { Empty, Page, PageHeader } from './ui/Layout'

export function LessonsView({ data }: { data: DashboardData }) {
  const lesson = data.buildQueue[0]

  return (
    <Page>
      <PageHeader
        title="Lessons"
        meta={
          lesson
            ? <span className="inline-flex items-center gap-1.5"><Layers3 size={13} /><b className="text-sm text-ink tabular-nums">{data.buildQueue.length}</b> ready</span>
            : 'Nothing new'
        }
      />

      {lesson ? (
        lesson.type === 'character'
          ? <CharacterStudio key={`character:${lesson.id}`} item={lesson} />
          : <WordStudio key={`word:${lesson.id}`} item={lesson} />
      ) : (
        <Empty
          icon={<BookOpenCheck size={18} />}
          title="Lessons done for today"
          detail="Keep going with reading, or adjust your daily volume in settings."
        />
      )}
    </Page>
  )
}
