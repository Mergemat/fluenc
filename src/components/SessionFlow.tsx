import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Clock3 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { reviewItem, type DashboardData } from '../server/curriculum'
import { CharacterStudio } from './CharacterStudio'
import { CodebookDeck } from './CodebookDeck'
import { GetDeck } from './GetDeck'
import { ReviewDeck } from './ReviewDeck'
import { SentenceReviewDeck } from './SentenceReviewDeck'
import { WordStudio } from './WordStudio'
import { Button } from './ui/Button'
import { SessionBar, type SessionStage } from './SessionProgress'

const SESSION_SECONDS = 30 * 60
const GET_WINDOW_SECONDS = 5 * 60

type SessionState = 'ready' | 'active' | 'complete'

export function SessionFlow({ data }: { data: DashboardData }) {
  const queryClient = useQueryClient()
  const [sessionState, setSessionState] = useState<SessionState>('ready')
  const [stage, setStage] = useState<SessionStage>('review')
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_SECONDS)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [builtCount, setBuiltCount] = useState(0)
  const [readCount, setReadCount] = useState(0)
  const deadlineRef = useRef<number | null>(null)
  const cardStartedAt = useRef(Date.now())

  const activeCodebook = data.codebookQueue[0]
  const activeReview = data.reviewQueue[0]
  const activeBuild = data.buildQueue[0]
  const reviewTarget = activeCodebook ?? activeReview
  const dueCount = data.codebookQueue.length + data.reviewQueue.length
  const hasSessionMaterial = dueCount > 0 || data.buildQueue.length > 0 || data.getQueue.length > 0
  const timeExpired = remainingSeconds === 0

  const reviewMutation = useMutation({
    mutationFn: (rating: number) => {
      if (!reviewTarget) throw new Error('В Review нет карточки')
      return reviewItem({
        data: {
          itemType: reviewTarget.type,
          itemId: reviewTarget.id,
          rating,
          durationMs: Date.now() - cardStartedAt.current,
        },
      })
    },
    onSuccess: async () => {
      setReviewedCount((count) => count + 1)
      cardStartedAt.current = Date.now()
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (deadlineRef.current !== null && Date.now() >= deadlineRef.current) finishSession()
    },
  })

  useEffect(() => {
    if (sessionState !== 'active' || deadlineRef.current === null) return
    const updateTimer = () => {
      const seconds = Math.max(0, Math.ceil((deadlineRef.current! - Date.now()) / 1000))
      setRemainingSeconds(seconds)
    }
    updateTimer()
    const timer = window.setInterval(updateTimer, 1000)
    return () => window.clearInterval(timer)
  }, [sessionState])

  useEffect(() => {
    if (sessionState !== 'active') return

    if (stage === 'review' && dueCount === 0) {
      if (timeExpired) finishSession()
      else if (data.buildQueue.length) setStage('build')
      else if (data.getQueue.length) setStage('get')
      else finishSession()
      return
    }

    if (stage === 'build') {
      if (!activeBuild) {
        if (data.getQueue.length && !timeExpired) setStage('get')
        else finishSession()
        return
      }
      if (builtCount > 0 && remainingSeconds <= GET_WINDOW_SECONDS && data.getQueue.length) {
        setStage('get')
      }
      return
    }

    if (stage === 'get' && (!data.getQueue.length || timeExpired)) finishSession()
  }, [activeBuild, builtCount, data.buildQueue.length, data.getQueue.length, dueCount, remainingSeconds, sessionState, stage, timeExpired])

  function startSession() {
    setReviewedCount(0)
    setBuiltCount(0)
    setReadCount(0)
    setRemainingSeconds(SESSION_SECONDS)
    deadlineRef.current = Date.now() + SESSION_SECONDS * 1000
    cardStartedAt.current = Date.now()
    setStage(dueCount ? 'review' : data.buildQueue.length ? 'build' : 'get')
    setSessionState('active')
  }

  function finishSession() {
    deadlineRef.current = null
    setSessionState('complete')
  }

  function handleBuildComplete() {
    setBuiltCount((count) => count + 1)
    if (deadlineRef.current !== null && Date.now() >= deadlineRef.current) finishSession()
  }

  if (sessionState === 'ready') {
    return (
      <SessionStart
        buildCount={data.buildQueue.length}
        dueCount={dueCount}
        getCount={data.getQueue.length}
        hasMaterial={hasSessionMaterial}
        onStart={startSession}
      />
    )
  }

  if (sessionState === 'complete') {
    return (
      <SessionComplete
        built={builtCount}
        read={readCount}
        reviewed={reviewedCount}
        onClose={() => setSessionState('ready')}
      />
    )
  }

  return (
    <div className="min-h-screen">
      <SessionBar stage={stage}>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-xs font-bold tabular-nums ${timeExpired ? 'text-fluenc-red' : 'text-muted'}`}>{formatTime(remainingSeconds)}</span>
          <Button variant="secondary" type="button" onClick={finishSession}>Завершить</Button>
        </div>
      </SessionBar>

      {timeExpired ? <p className="mx-auto mt-4 mb-0 w-[min(900px,calc(100%-28px))] text-center text-xs text-fluenc-red">Время вышло. Закончите текущую карточку.</p> : null}

      {stage === 'review' && activeCodebook ? (
        <CodebookDeck
          key={`${activeCodebook.type}:${activeCodebook.id}`}
          item={activeCodebook}
          remaining={dueCount}
          pending={reviewMutation.isPending}
          onRate={(rating) => reviewMutation.mutate(rating)}
        />
      ) : stage === 'review' && activeReview?.type === 'sentence' ? (
        <SentenceReviewDeck
          key={`${activeReview.type}:${activeReview.id}`}
          item={activeReview}
          remaining={dueCount}
          pending={reviewMutation.isPending}
          onRate={(rating) => reviewMutation.mutate(rating)}
        />
      ) : stage === 'review' && activeReview && activeReview.type !== 'sentence' ? (
        <ReviewDeck
          key={`${activeReview.type}:${activeReview.id}`}
          item={activeReview}
          remaining={dueCount}
          pending={reviewMutation.isPending}
          onRate={(rating) => reviewMutation.mutate(rating)}
        />
      ) : stage === 'build' && activeBuild?.type === 'character' ? (
        <div className="mx-auto max-w-[900px] px-7 py-8 max-[720px]:px-3.5 max-[720px]:py-5">
          <CharacterStudio key={`${activeBuild.type}:${activeBuild.id}`} item={activeBuild} onComplete={handleBuildComplete} />
        </div>
      ) : stage === 'build' && activeBuild?.type === 'word' ? (
        <div className="mx-auto max-w-[900px] px-7 py-8 max-[720px]:px-3.5 max-[720px]:py-5">
          <WordStudio key={`${activeBuild.type}:${activeBuild.id}`} item={activeBuild} onComplete={handleBuildComplete} />
        </div>
      ) : stage === 'get' ? (
        <GetDeck
          items={data.getQueue}
          onComplete={(count) => {
            setReadCount(count)
            finishSession()
          }}
        />
      ) : null}

      {reviewMutation.isError ? <p className="mx-auto mb-7 w-[min(900px,calc(100%-28px))] text-center text-xs text-fluenc-red" role="alert">Не удалось сохранить повторение.</p> : null}
    </div>
  )
}

function SessionStart({ buildCount, dueCount, getCount, hasMaterial, onStart }: { buildCount: number; dueCount: number; getCount: number; hasMaterial: boolean; onStart: () => void }) {
  return (
    <main className="mx-auto grid min-h-screen w-[min(760px,calc(100%-48px))] content-center py-16 max-[720px]:w-[calc(100%-28px)]">
      <p className="mb-3 text-[10px] font-bold tracking-[.12em] text-jade uppercase">Сегодня</p>
      <h1 className="m-0 max-w-[620px] text-[clamp(42px,8vw,78px)] leading-[.95] font-semibold tracking-[-.065em]">Одно занятие.<br />Тридцать минут.</h1>
      <p className="mt-5 mb-8 max-w-[510px] text-sm leading-[1.65] text-muted">Сначала повторите то, что пора вспомнить. Затем изучите новое. В конце прочитайте знакомые предложения.</p>

      <div className="mb-8 grid max-w-[560px] grid-cols-3 border-y border-line py-4">
        <SessionMetric label="повторить" value={dueCount} />
        <SessionMetric label="изучить" value={buildCount} />
        <SessionMetric label="прочитать" value={getCount} />
      </div>

      <div>
        <Button className="min-h-12 px-6 text-sm" type="button" disabled={!hasMaterial} onClick={onStart}>
          <Clock3 size={18} /> {hasMaterial ? 'Начать занятие' : 'На сегодня всё'}
        </Button>
      </div>
    </main>
  )
}

function SessionMetric({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col gap-1 border-l border-line pl-4 first:border-0 first:pl-0">
      <b className="text-2xl tracking-[-.04em] tabular-nums">{value}</b>
      <small className="text-[9px] font-bold tracking-[.08em] text-muted uppercase">{label}</small>
    </span>
  )
}

function SessionComplete({ built, onClose, read, reviewed }: { built: number; onClose: () => void; read: number; reviewed: number }) {
  return (
    <main className="mx-auto grid min-h-screen w-[min(680px,calc(100%-48px))] place-content-center justify-items-start py-16 max-[720px]:w-[calc(100%-28px)]">
      <span className="mb-5 grid size-11 place-items-center rounded-full bg-jade text-white"><Check size={20} /></span>
      <p className="mb-2 text-[10px] font-bold tracking-[.12em] text-jade uppercase">Занятие закончено</p>
      <h1 className="m-0 text-[clamp(40px,7vw,68px)] leading-none tracking-[-.06em]">够了</h1>
      <p className="mt-4 mb-7 text-sm text-muted">Повторено {reviewed}, изучено {built}, прочитано {read}.</p>
      <Button type="button" onClick={onClose}>Готово</Button>
    </main>
  )
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
