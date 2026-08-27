import type HanziWriterType from 'hanzi-writer'
import { Check, LoaderCircle, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ErrorNote } from './ui/Layout'

const SIZE = 240

/** 米字格 — classic calligraphy guide grid: border, cross, dashed diagonals. */
function RiceGrid() {
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
      <line x1="50" y1="0" x2="50" y2="100" stroke="var(--color-line)" strokeWidth="1" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="var(--color-line)" strokeWidth="1" />
      <line x1="8" y1="8" x2="92" y2="92" stroke="var(--color-line)" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.7" />
      <line x1="92" y1="8" x2="8" y2="92" stroke="var(--color-line)" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.7" />
    </svg>
  )
}

const captions: Record<'idle' | 'writing' | 'done', string> = {
  idle: 'Tap play to watch, then trace it',
  writing: 'Write it — hints appear after a couple of misses',
  done: 'Nicely done',
}

export function WritingPad({ character }: { character: string }) {
  const targetRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriterType | null>(null)
  const [status, setStatus] = useState<'idle' | 'writing' | 'done'>('idle')
  const [writerState, setWriterState] = useState<'loading' | 'ready' | 'error'>('loading')

  const startQuiz = (writer = writerRef.current) => {
    if (!writer) return
    setStatus('writing')
    writer.quiz({
      showHintAfterMisses: 2,
      onComplete: () => setStatus('done'),
    })
  }

  useEffect(() => {
    let active = true
    setWriterState('loading')
    setStatus('idle')
    import('hanzi-writer').then(({ default: HanziWriter }) => {
      if (!active || !targetRef.current) return
      targetRef.current.replaceChildren()
      writerRef.current = HanziWriter.create(targetRef.current, character, {
        width: SIZE,
        height: SIZE,
        padding: 14,
        showCharacter: false,
        showOutline: false,
        strokeColor: '#2b3a42',
        drawingColor: '#2b3a42',
        drawingWidth: 24,
        highlightColor: '#2f6d9e',
        onLoadCharDataSuccess: () => {
          if (!active) return
          setWriterState('ready')
          startQuiz(writerRef.current)
        },
        onLoadCharDataError: () => {
          if (active) setWriterState('error')
        },
      })
    }).catch(() => {
      if (active) setWriterState('error')
    })
    return () => {
      active = false
      writerRef.current?.cancelQuiz()
      writerRef.current = null
    }
  }, [character])

  const ring = writerState !== 'ready'
    ? '0 0 0 1.5px var(--color-line), 0 2px 10px rgb(43 58 66 / 0.06)'
    : status === 'writing'
      ? '0 0 0 2px rgb(47 109 158 / 0.45), 0 6px 20px rgb(47 109 158 / 0.12)'
      : status === 'done'
        ? '0 0 0 2px rgb(47 109 158 / 0.6), 0 6px 20px rgb(43 58 66 / 0.1)'
        : '0 0 0 1.5px rgb(139 160 168 / 0.35), 0 2px 10px rgb(43 58 66 / 0.06)'

  return (
    <div>
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <filter id="fluenc-ink" filterUnits="userSpaceOnUse" x="-150" y="-150" width="1400" height="1400">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="mb-4 flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={writerState !== 'ready'}
          onClick={() => writerRef.current?.animateCharacter()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-canvas px-4 text-[13px] font-medium text-ink transition-colors hover:bg-line/60 disabled:opacity-35"
        >
          <Play size={13} /> Strokes
        </button>
        <button
          type="button"
          disabled={writerState !== 'ready'}
          onClick={() => startQuiz()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-canvas px-4 text-[13px] font-medium text-ink transition-colors hover:bg-line/60 disabled:opacity-35"
        >
          {status === 'done' ? <Check size={13} /> : <RotateCcw size={13} />}
          {status === 'done' ? 'Again' : 'Retry'}
        </button>
      </div>
      {writerState === 'error' ? (
        <ErrorNote>Could not load strokes. Check your connection and reload the page.</ErrorNote>
      ) : null}
      <div
        className="writing-pad relative mx-auto overflow-hidden rounded-[2rem] bg-paper transition-[box-shadow] duration-300"
        style={{ width: SIZE, height: SIZE, boxShadow: ring }}
      >
        <RiceGrid />
        {writerState === 'loading' ? (
          <div className="absolute inset-0 grid place-items-center bg-paper">
            <LoaderCircle size={22} className="animate-spin text-faint" />
          </div>
        ) : null}
        <div ref={targetRef} className="relative" aria-label={`Writing pad for ${character}`} role="img" />
        {status === 'done' ? (
          <span className="animate-pop absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-glaze text-paper shadow-[0_4px_12px_rgb(47_109_158/0.4)]">
            <Check size={15} />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-center text-xs text-faint">
        {writerState === 'loading' ? 'Loading strokes…' : captions[status]}
      </p>
    </div>
  )
}
