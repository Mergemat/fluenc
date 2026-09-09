import type { DashboardData } from '../server/curriculum'
import { useSearch } from '@tanstack/react-router'
import { CharacterStudio } from './CharacterStudio'
import { CharacterStudioPrototype } from './CharacterStudioPrototype'
import { exampleCharacter } from './character-studio-prototype/data'
import { WordStudio } from './WordStudio'
import { Empty, Page, PageHeader } from './ui/Layout'

export function LessonsView({ data }: { data: DashboardData }) {
  const { example } = useSearch({ from: '/' })
  const lesson = data.buildQueue[0]
  const character = import.meta.env.DEV && example === 'ming' ? exampleCharacter : lesson?.type === 'character' ? lesson : null

  if (character) {
    return (
      <section className={import.meta.env.DEV ? 'cs-host' : 'mx-auto w-full max-w-6xl px-3 py-3 sm:px-5 md:px-8 md:py-6'}>
        {import.meta.env.DEV ? <CharacterStudioPrototype key={`prototype:${character.id}:${example ?? 'lesson'}`} items={data.buildQueue.filter((entry) => entry.type === 'character')} example={example === 'ming'} /> : <CharacterStudio key={`character:${character.id}`} item={character} />}
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
          title="Done for today"
          detail="Keep going with reading, or adjust your daily volume in settings."
        />
      )}
    </Page>
  )
}
