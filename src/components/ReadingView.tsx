import type { DashboardData } from '../server/curriculum'
import { ReadingLesson } from './ReadingLesson'
import { Empty, Page, PageHeader } from './ui/Layout'

export function ReadingView({ data }: { data: DashboardData }) {
  const sentence = data.getQueue[0]

  return (
    <Page>
      <PageHeader
        title="Read"
        meta={sentence ? `${data.getQueue.length} sentences` : 'Nothing yet'}
      />

      {sentence ? <ReadingLesson key={sentence.id} item={sentence} /> : (
        <Empty
          title="Nothing to read yet"
          detail="New sentences unlock as you learn the characters and words they are built from."
        />
      )}
    </Page>
  )
}
