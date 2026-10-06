import { ArrowRight } from 'lucide-react'
import { useState } from 'react'

import { useProgressMutation } from '../offline/useProgressMutation'
import { saveEnrollment } from '../offline/progress'
import type { DashboardData } from '../lib/learner-views'
import { MandarinAudioButton } from './MandarinAudioButton'
import { Button } from './ui/Button'
import { ErrorNote } from './ui/Layout'

type ReadingItem = DashboardData['getQueue'][number]

export function ReadingLesson({ item }: { item: ReadingItem }) {
  const [revealed, setRevealed] = useState(false)
  const mutation = useProgressMutation(() => saveEnrollment({ itemType: 'sentence', itemId: item.id }))

  return <article className="reading-lesson">
    <div className="reading-content">
      <p className="study-label">Read for meaning</p>
      <p className="reading-hanzi font-hanzi" lang="zh-CN">{item.hanzi}</p>
      <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} label="Play sentence" />
      {revealed ? <div className="reading-answer"><p>{item.pinyin}</p><h2>{item.meaning}</h2></div> : <p className="recall-hint">Read the whole line, then listen.</p>}
    </div>
    <footer className="lesson-footer"><p>{revealed ? 'Take the sentence with you.' : 'What does it mean?'}</p>
      {revealed ? <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Next sentence'} <ArrowRight size={16} /></Button> : <Button type="button" onClick={() => setRevealed(true)}>Check meaning <ArrowRight size={16} /></Button>}
    </footer>
    {mutation.isError ? <ErrorNote>Could not save this sentence. Try again.</ErrorNote> : null}
  </article>
}
