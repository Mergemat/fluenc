import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { directCharacters } from '../lib/character-props'
import { isLearning, REVIEW_TIME_ZONE } from '../lib/review-schedule'
import type { DashboardData } from '../server/curriculum'
import { ReviewCard } from './ReviewCard'
import { DitherButton } from './dither-kit/button'
import { DitherGradient } from './dither-kit/gradient'

function reviewTime(date: string, includeTime = false) {
  return new Date(date).toLocaleString('en-GB', {
    timeZone: REVIEW_TIME_ZONE, day: 'numeric', month: 'long',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  })
}

export function ReviewView({ data }: { data: DashboardData }) {
  const [selected, setSelected] = useState(() => data.reviewQueue[0])
  // A learning step becoming due must not replace the card being answered.
  const active = data.reviewQueue.find(item => item.type === selected?.type && item.id === selected.id && item.reps === selected.reps)
    ?? data.reviewQueue[0]
  if (active?.type !== selected?.type || active?.id !== selected?.id || active?.reps !== selected?.reps) setSelected(active)
  // The session's high-water mark drives the progress bar as the queue drains.
  const [sessionSize, setSessionSize] = useState(data.reviewQueue.length)
  if (data.reviewQueue.length > sessionSize) setSessionSize(data.reviewQueue.length)

  const learning = data.scheduledQueue.filter(item => isLearning(item.card.state))
  const nextLearningAt = learning.reduce<string | null>((next, item) => !next || item.card.due < next ? item.card.due : next, null)
  const hasCards = data.reviewQueue.length + data.scheduledQueue.length > 0
  const done = sessionSize - data.reviewQueue.length

  const state = active ? null : nextLearningAt ? 'waiting' : hasCards ? 'finished' : 'empty'

  return <section className="dx-review">
    <header className="dx-bar">
      <p className="dx-crumb"><span>review</span>{active
        ? <><b>{data.reviewQueue.length}</b>{' '}<span>ready{learning.length ? ` · ${learning.length} learning` : ''} · {active.type === 'character' && directCharacters.has(active.hanzi) ? 'prop' : active.type}</span></>
        : <span>· {state === 'waiting' ? 'short break' : state === 'finished' ? 'done for today' : 'nothing yet'}</span>}</p>
      <div className="dx-progress" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={sessionSize} aria-valuenow={done}>
        <DitherGradient from="grey" direction="right" cell={2} opacity={.5} />
        <span className="dx-progress-fill" style={{ width: `${sessionSize ? done / sessionSize * 100 : 100}%` }}><DitherGradient from={active ? 'blue' : 'green'} direction="left" cell={2} /></span>
      </div>
    </header>

    {active ? <ReviewCard key={`${active.type}:${active.id}:${active.reps}`} item={active} />
      : <ReviewDone state={state!} data={data} reviewed={done} learning={learning.length} nextLearningAt={nextLearningAt} />}
  </section>
}

/** What to do when no card is due: a short break with a live countdown, or the next step. */
function ReviewDone({ state, data, reviewed, learning, nextLearningAt }: { state: 'waiting' | 'finished' | 'empty'; data: DashboardData; reviewed: number; learning: number; nextLearningAt: string | null }) {
  const navigate = useNavigate()
  const now = useNow(state === 'waiting')
  const next = () => void navigate({ to: '/lessons' })
  useEffect(() => {
    if (state === 'waiting') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, button, a')) return
      next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const mark = state === 'waiting' ? '等' : state === 'finished' ? '休' : '始'
  const title = state === 'waiting' ? 'a short break' : state === 'finished' ? 'reviews finished' : 'start with a lesson'
  const detail = state === 'waiting'
    ? `${learning} ${learning === 1 ? 'card still needs' : 'cards still need'} practice — they come back here by themselves`
    : state === 'finished' ? 'spend the rest on new characters, then reading'
    : 'learn a character or word first — reviews keep what you already understand'
  const stats: [string, string][] = state === 'waiting' && nextLearningAt
    ? [['back in', countdown(Date.parse(nextLearningAt) - now)], ['at · shanghai', reviewTime(nextLearningAt, true).split(' ').at(-1) ?? '']]
    : [
      ...(reviewed ? [['reviewed now', String(reviewed)] as [string, string]] : []),
      ...(data.nextReviewAt ? [['next reviews', reviewDay(data.nextReviewAt, now)] as [string, string]] : []),
      ['characters', String(data.progress.introducedCharacters)],
      ['new ready', String(data.buildQueue.length)],
    ]

  return <div className="dx-done" data-state={state} role={state === 'waiting' ? 'status' : undefined}>
    <div className="dx-done-body">
      <span className="dx-done-mark" aria-hidden="true"><DitherGradient from={state === 'waiting' ? 'orange' : 'green'} direction="up" cell={2} opacity={.55} /><span className="font-hanzi" lang="zh-CN">{mark}</span></span>
      <h1>{title}</h1>
      <p>{detail}</p>
      <dl className="dx-done-stats">{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </div>
    {state === 'waiting' ? null : <footer className="dx-done-actions">
      <DitherButton className="dx-action" color="blue" variant="gradient" onClick={next}><span>{state === 'empty' ? 'start your first lesson' : 'learn new characters'}</span><kbd>↵</kbd></DitherButton>
      {state === 'finished' && data.getQueue.length ? <Link to="/reading" className="dx-chip">read sentences · {data.getQueue.length}</Link> : null}
    </footer>}
  </div>
}

function useNow(ticking: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ticking])
  return now
}

/** "tomorrow", or a short weekday and date in Shanghai time ("thu 8"). */
function reviewDay(date: string, now: number) {
  const day = (time: number) => new Date(time).toLocaleDateString('en-CA', { timeZone: REVIEW_TIME_ZONE })
  if (day(Date.parse(date)) === day(now + 86_400_000)) return 'tomorrow'
  return new Date(date).toLocaleDateString('en-GB', { timeZone: REVIEW_TIME_ZONE, weekday: 'short', day: 'numeric' }).toLowerCase()
}

function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(seconds / 60)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
