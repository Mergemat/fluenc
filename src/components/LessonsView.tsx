import { useState } from 'react'

import type { DashboardData } from '../server/curriculum'
import { CharacterStudio } from './CharacterStudio'
import { WordStudio } from './WordStudio'
import { Empty, Page, PageHeader } from './ui/Layout'

export function LessonsView({ data }: { data: DashboardData }) {
  const [selected, setSelected] = useState(() => data.buildQueue[0])
  // Sync can unlock words and reorder characters while a lesson is open.
  // Advance only when the selected lesson has left the build queue.
  const lesson = data.buildQueue.find(item => item.type === selected?.type && item.id === selected.id)
    ?? data.buildQueue[0]
  if (lesson?.type !== selected?.type || lesson?.id !== selected?.id) setSelected(lesson)
  const character = lesson?.type === 'character' ? lesson : null

  if (character) {
    return (
      <section className="cs-host">
        <CharacterStudio key={`character:${character.id}`} item={character} />
      </section>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Build"
        meta={lesson ? `${data.buildQueue.length} ready` : 'Nothing new'}
      />

      {lesson?.type === 'word' ? (
        <WordStudio key={`word:${lesson.id}`} item={lesson} />
      ) : (
        <Empty
          title="All lessons complete"
          detail="You’ve worked through the available characters and words. Keep practicing with reviews and reading."
        />
      )}
    </Page>
  )
}
