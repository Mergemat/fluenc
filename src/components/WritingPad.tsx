import type HanziWriterType from 'hanzi-writer'
import { Check, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from './ui/Button'
import { ErrorNote } from './ui/Layout'

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
        width: 200,
        height: 200,
        padding: 10,
        showCharacter: false,
        showOutline: false,
        strokeColor: '#2b3a42',
        drawingColor: '#2b3a42',
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

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-1">
        <Button variant="ghost" disabled={writerState !== 'ready'} onClick={() => writerRef.current?.animateCharacter()}>
          <Play size={14} /> Strokes
        </Button>
        <Button variant="ghost" disabled={writerState !== 'ready'} onClick={() => startQuiz()}>
          {status === 'done' ? <Check size={14} /> : <RotateCcw size={14} />}
          {writerState === 'loading' ? 'Loading…' : status === 'done' ? 'Again' : 'Retry'}
        </Button>
      </div>
      {writerState === 'error' ? (
        <ErrorNote>Could not load strokes. Check your connection and reload the page.</ErrorNote>
      ) : null}
      <div
        className="mx-auto size-[200px] rounded-2xl bg-paper"
        style={{
          boxShadow: status === 'writing'
            ? '0 0 0 2px rgb(47 109 158 / 0.4), 0 4px 14px rgb(43 58 66 / 0.1)'
            : status === 'done'
              ? '0 0 0 2px rgb(139 160 168 / 0.4)'
              : '0 2px 8px rgb(43 58 66 / 0.08)',
          backgroundImage: 'linear-gradient(to right, transparent calc(50%-.5px), #dbe5e0 calc(50%-.5px), #dbe5e0 calc(50%+.5px), transparent calc(50%+.5px)), linear-gradient(to bottom, transparent calc(50%-.5px), #dbe5e0 calc(50%-.5px), #dbe5e0 calc(50%+.5px), transparent calc(50%+.5px))',
        }}
        ref={targetRef}
        aria-label={`Writing pad for ${character}`}
      />
    </div>
  )
}
