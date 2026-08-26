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
        width: 190,
        height: 190,
        padding: 10,
        showCharacter: false,
        showOutline: false,
        strokeColor: '#17211e',
        drawingColor: '#176b5b',
        highlightColor: '#c95746',
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
    <section className="mx-7 grid grid-cols-[minmax(0,1fr)_190px] items-center gap-6 border-t border-line py-5 max-[720px]:mx-4 max-[720px]:grid-cols-1">
      <div>
        <h2 className="m-0 text-xs font-bold">Напишите один раз</h2>
        <p className="mt-1 mb-0 text-[10px] text-muted">Поле уже активно.</p>
        <div className="mt-3 flex gap-[7px]">
          <Button type="button" variant="secondary" disabled={writerState !== 'ready'} onClick={() => writerRef.current?.animateCharacter()}><Play size={15} /> Порядок</Button>
          <Button type="button" variant="secondary" disabled={writerState !== 'ready'} onClick={() => startQuiz()}>{status === 'done' ? <Check size={15} /> : <RotateCcw size={15} />} {writerState === 'loading' ? 'Загружаю…' : status === 'done' ? 'Ещё раз' : 'Стереть'}</Button>
        </div>
        {writerState === 'error' ? <p className="mt-[9px]! text-fluenc-red!" role="alert">Не удалось загрузить штрихи. Проверьте соединение и обновите страницу.</p> : null}
      </div>
      <div className={`size-[190px] border bg-[linear-gradient(to_right,transparent_calc(50%-.5px),#e3e8e5_calc(50%-.5px),#e3e8e5_calc(50%+.5px),transparent_calc(50%+.5px)),linear-gradient(to_bottom,transparent_calc(50%-.5px),#e3e8e5_calc(50%-.5px),#e3e8e5_calc(50%+.5px),transparent_calc(50%+.5px))] max-[720px]:mx-auto ${status === 'writing' ? 'border-fluenc-blue' : status === 'done' ? 'border-jade' : 'border-[#cfd8d3]'}`} ref={targetRef} aria-label={`Поле для написания ${character}`} />
    </section>
  )
}
