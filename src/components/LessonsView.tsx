import { useState } from 'react'

import type { DashboardData } from '../server/curriculum'
import { CharacterLesson } from './CharacterLesson'
import { WordLesson } from './WordLesson'
import { Empty, Page, PageHeader } from './ui/Layout'

export function LessonsView({ data }: { data: DashboardData }) {
  const [selected, setSelected] = useState(() => data.buildQueue[0])
  // Sync can unlock words and reorder characters while a lesson is open.
  // Advance only when the selected lesson has left the build queue.
  const lesson = data.buildQueue.find(item => item.type === selected?.type && item.id === selected.id)
    ?? data.buildQueue[0]
  if (lesson?.type !== selected?.type || lesson?.id !== selected?.id) setSelected(lesson)

  if (lesson?.type === 'character') return <CharacterLesson key={`character:${lesson.id}`} item={lesson} />
  if (lesson?.type === 'word') return <WordLesson key={`word:${lesson.id}`} item={lesson} />

  return (
    <div className="dx-lesson-page">
      <Page>
        <PageHeader
          title="Build"
          meta="Nothing new"
        />

        <Empty
          title="All lessons complete"
          detail="You’ve worked through the available characters and words. Keep practicing with reviews and reading."
        />
      </Page>
    </div>
  )
}
