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
        strokeColor: '#171716',
        drawingColor: '#171716',
        highlightColor: '#b0402c',
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
        className={`mx-auto size-[200px] border ${status === 'writing' ? 'border-ink' : status === 'done' ? 'border-faint' : 'border-line'} bg-paper bg-[linear-gradient(to_right,transparent_calc(50%-.5px),#efeeea_calc(50%-.5px),#efeeea_calc(50%+.5px),transparent_calc(50%+.5px)),linear-gradient(to_bottom,transparent_calc(50%-.5px),#efeeea_calc(50%-.5px),#efeeea_calc(50%+.5px),transparent_calc(50%+.5px))]`}
        ref={targetRef}
        aria-label={`Writing pad for ${character}`}
      />
    </div>
  )
}
