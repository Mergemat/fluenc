import type { DashboardData } from '../server/curriculum'
import { CharacterStudioPrototype } from './CharacterStudioPrototype'
import { WordStudio } from './WordStudio'
import { Empty, Page, PageHeader } from './ui/Layout'

export function LessonsView({ data }: { data: DashboardData }) {
  const lesson = data.buildQueue[0]

  if (lesson?.type === 'character') {
    return (
      <section className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-5 md:px-8 md:py-6">
        <CharacterStudioPrototype key={`character:${lesson.id}`} item={lesson} />
      </section>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Build"
        meta={lesson ? `${data.buildQueue.length} ready` : 'Nothing new'}
      />

      {lesson ? (
        <WordStudio key={`word:${lesson.id}`} item={lesson} />
      ) : (
        <Empty
          title="Done for today"
          detail="Keep going with reading, or adjust your daily volume in settings."
        />
      )}
    </Page>
  )
}
