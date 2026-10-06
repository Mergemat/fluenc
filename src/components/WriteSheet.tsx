// Writing practice as a sheet over the lesson; strokes load from the local precached data.
import type HanziWriterType from 'hanzi-writer'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { DitherButton } from './dither-kit/button'
import { DitherGradient } from './dither-kit/gradient'
import { ditherColor, PixelLoader } from './ui/Dither'

export function WriteSheet({ hanzi, onClose }: { hanzi: string; onClose: () => void }) {
  const target = useRef<HTMLDivElement>(null)
  const writer = useRef<HanziWriterType | null>(null)
  const [state, setState] = useState<'loading' | 'writing' | 'done' | 'error'>('loading')
  const [misses, setMisses] = useState(0)
  const size = typeof window === 'undefined' ? 280 : Math.min(320, window.innerWidth - 64, window.innerHeight - 260)

  useEffect(() => {
    let active = true
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    void import('hanzi-writer').then(({ default: HanziWriter }) => {
      if (!active || !target.current) return
      const styles = getComputedStyle(target.current)
      const ink = styles.getPropertyValue('--dx-fg').trim() || '#ededed'
      // hanzi-writer only parses hex and comma rgb(a), so take the accent from the kit palette.
      const accent = ditherColor('blue')
      target.current.replaceChildren()
      const quiz = () => writer.current?.quiz({ showHintAfterMisses: 2, onMistake: () => setMisses(value => value + 1), onComplete: () => setState('done') })
      writer.current = HanziWriter.create(target.current, hanzi, {
        width: size, height: size, padding: 12, showCharacter: false, showOutline: true,
        outlineColor: styles.getPropertyValue('--dx-line').trim() || '#2a2a30',
        strokeColor: ink, drawingColor: accent, highlightColor: accent, drawingWidth: 22,
        charDataLoader: (character, onLoad, onError) => {
          fetch(`/hanzi/${character}.json`).then(response => response.ok ? response.json() : Promise.reject()).then(onLoad, onError)
        },
        onLoadCharDataSuccess: () => { if (!active) return; setState('writing'); quiz() },
        onLoadCharDataError: () => { if (active) setState('error') },
      })
    }).catch(() => { if (active) setState('error') })
    return () => { active = false; window.removeEventListener('keydown', onKey); writer.current?.cancelQuiz() }
  }, [hanzi])

  const restart = () => { setMisses(0); setState('writing'); writer.current?.quiz({ showHintAfterMisses: 2, onMistake: () => setMisses(value => value + 1), onComplete: () => setState('done') }) }

  return <div className="dx-sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="dx-sheet" role="dialog" aria-modal="true" aria-label={`Write ${hanzi}`}>
      <DitherGradient className="dx-wash" from="blue" direction="up" opacity={.3} />
      <header><span className="dx-label-text">write · {hanzi}</span><button type="button" className="dx-icon-button" onClick={onClose} aria-label="Close"><X size={16} /></button></header>
      <div className="dx-pad" style={{ width: size, height: size }}>
        <div ref={target} aria-label={`Writing pad for ${hanzi}`} role="img" />
        {state === 'loading' ? <span className="dx-pad-loader"><PixelLoader label="Loading strokes" size={5} /></span> : null}
      </div>
      <p className="dx-sheet-status" aria-live="polite">{state === 'loading' ? 'loading strokes' : state === 'error' ? 'strokes unavailable' : state === 'done' ? `done${misses ? ` · ${misses} miss${misses > 1 ? 'es' : ''}` : ' · clean'}` : 'trace each stroke · hints after 2 misses'}</p>
      <footer>
        <DitherButton color="grey" variant="dotted" disabled={state === 'loading' || state === 'error'} onClick={() => writer.current?.animateCharacter()}>show strokes</DitherButton>
        <DitherButton color={state === 'done' ? 'green' : 'blue'} variant="gradient" disabled={state === 'loading' || state === 'error'} onClick={restart}>{state === 'done' ? 'again' : 'restart'}</DitherButton>
      </footer>
    </section>
  </div>
}
