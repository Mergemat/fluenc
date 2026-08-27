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
        meta={lesson ? `${data.buildQueue.length} ready` : 'Nothing new'}
      />

      {lesson ? (
        lesson.type === 'character'
          ? <CharacterStudio key={`character:${lesson.id}`} item={lesson} />
          : <WordStudio key={`word:${lesson.id}`} item={lesson} />
      ) : (
        <Empty
          title="Done for today"
          detail="Keep going with reading, or adjust your daily volume in settings."
        />
      )}
    </Page>
  )
}
