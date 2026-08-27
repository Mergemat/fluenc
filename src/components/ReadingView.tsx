import { BookOpen } from 'lucide-react'

import type { DashboardData } from '../server/curriculum'
import { ReadingLesson } from './ReadingLesson'
import { Empty, Page, PageHeader } from './ui/Layout'

export function ReadingView({ data }: { data: DashboardData }) {
  const sentence = data.getQueue[0]

  return (
    <Page>
      <PageHeader
        title="Read"
        meta={sentence ? <><b className="text-sm text-ink tabular-nums">{data.getQueue.length}</b> sentences</> : 'Nothing yet'}
      />

      {sentence ? <ReadingLesson key={sentence.id} item={sentence} /> : (
        <Empty
          icon={<BookOpen size={18} />}
          title="Nothing to read yet"
          detail="New sentences unlock as you learn the characters and words they are built from."
        />
      )}
    </Page>
  )
}
