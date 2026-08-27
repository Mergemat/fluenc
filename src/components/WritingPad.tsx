import type HanziWriterType from 'hanzi-writer'
import { Check, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from './ui/Button'

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
        width: 180,
        height: 180,
        padding: 10,
        showCharacter: false,
        showOutline: false,
        strokeColor: '#1a1b1c',
        drawingColor: '#2e6b57',
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
    <section className="border-t border-line p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="m-0 text-xs font-bold uppercase tracking-wide">Write it once</h2>
        <div className="flex gap-1.5">
          <Button variant="secondary" disabled={writerState !== 'ready'} onClick={() => writerRef.current?.animateCharacter()}>
            <Play size={14} /> Strokes
          </Button>
          <Button variant="secondary" disabled={writerState !== 'ready'} onClick={() => startQuiz()}>
            {status === 'done' ? <Check size={14} /> : <RotateCcw size={14} />}
            {writerState === 'loading' ? 'Loading…' : status === 'done' ? 'Again' : 'Retry'}
          </Button>
        </div>
      </div>
      {writerState === 'error' ? (
        <p className="m-0 mb-3 text-xs text-danger" role="alert">Could not load strokes. Check your connection and reload the page.</p>
      ) : null}
      <div
        className={`mx-auto size-[180px] border bg-paper ${status === 'writing' ? 'border-accent' : status === 'done' ? 'border-accent/60' : 'border-line'} bg-[linear-gradient(to_right,transparent_calc(50%-.5px),#eeeeea_calc(50%-.5px),#eeeeea_calc(50%+.5px),transparent_calc(50%+.5px)),linear-gradient(to_bottom,transparent_calc(50%-.5px),#eeeeea_calc(50%-.5px),#eeeeea_calc(50%+.5px),transparent_calc(50%+.5px))]`}
        ref={targetRef}
        aria-label={`Writing pad for ${character}`}
      />
    </section>
  )
}
