// Hanzi building blocks: stroke glyph, movie-coded pinyin, audio, and usage examples.
// Each keeps a fixed footprint while it loads so nothing around it moves.
import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, type CSSProperties } from 'react'

import { useMandarinSpeech } from '../../hooks/useMandarinSpeech'
import { getToneDetail } from '../../lib/tones'
import { libraryQueryOptions } from '../../offline/queries'
import { DitherGradient } from '../dither-kit/gradient'
import { partColor, partPixelColor, PixelLoader } from './Dither'

export function useStrokes(hanzi: string) {
  return useQuery({
    queryKey: ['character-strokes', hanzi],
    queryFn: async () => {
      const { default: HanziWriter } = await import('hanzi-writer')
      const response = await fetch(`/hanzi/${hanzi}.json`)
      if (!response.ok) throw new Error('Character strokes unavailable')
      const data = await response.json() as { strokes: string[]; owners: string[] }
      return { ...data, transform: HanziWriter.getScalingTransform(1024, 1024, 55).transform }
    },
    staleTime: Infinity,
  })
}

/**
 * The character in a square box. The font glyph holds the exact footprint while strokes load,
 * then the stroke SVG fades in on top of it — nothing moves. A lit part is filled by a
 * dither-kit gradient clipped to that part's strokes.
 */
export function HanziGlyph({ hanzi, parts, highlighted = null, xray = false, concealed = false, onSelect, onHover }: {
  hanzi: string
  parts: string[]
  highlighted?: string | null
  xray?: boolean
  concealed?: boolean
  onSelect?: (code: string) => void
  onHover?: (code: string | null) => void
}) {
  const shape = useStrokes(hanzi)
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const owners = shape.data?.owners
  const ready = Boolean(shape.data && owners?.length === shape.data.strokes.length && owners.every(code => parts.includes(code)))
  const lit = (code: string) => !concealed && (xray || highlighted === code)
  const partPath = (code: string) => shape.data!.strokes.filter((_, index) => owners![index] === code).join(' ')

  return <div className="dx-glyph" data-state={ready ? 'ready' : shape.isError || (shape.data && !ready) ? 'font' : 'loading'}>
    <span className="dx-glyph-ghost font-hanzi" lang="zh-CN" aria-hidden={ready}>{hanzi}</span>
    {ready && shape.data ? <svg viewBox="0 0 1024 1024" role="img" aria-label={hanzi}>
      <defs>{parts.map((code, index) => <clipPath key={code} id={`${id}-c${index}`} clipPathUnits="objectBoundingBox">
        <path transform={`scale(${1 / 1024}) ${shape.data!.transform}`} d={partPath(code)} />
      </clipPath>)}</defs>
      <g transform={shape.data.transform}>{parts.map((code, index) => <g key={code} className="dx-part"
        data-lit={lit(code)} data-dim={!concealed && Boolean(highlighted) && highlighted !== code && !xray}
        style={{ '--part': partColor(index) } as CSSProperties}
        onClick={onSelect && !concealed ? () => onSelect(code) : undefined}
        onPointerEnter={onHover && !concealed ? event => { if (event.pointerType !== 'touch') onHover(code) } : undefined}
        onPointerLeave={onHover && !concealed ? () => onHover(null) : undefined}>
        <path d={partPath(code)} />
      </g>)}</g>
    </svg> : null}
    {ready ? parts.map((code, index) => lit(code) ? <div key={code} className="dx-part-fill" style={{ clipPath: `url(#${id}-c${index})` }}>
      <DitherGradient from={partPixelColor(index)} direction="up" cell={2} bloom="low" />
    </div> : null) : null}
  </div>
}

/**
 * Pinyin coloured by Hanzi Movie Method codes: the actor part (e.g. ti- in tīng) and the set
 * part (-eng). With the Ø set the actor carries the whole syllable (yī → y-/Ø).
 */
export function MoviePinyin({ pinyin, tone, actorKey, finalKey, className = '' }: { pinyin: string; tone: number; actorKey?: string; finalKey?: string; className?: string }) {
  if (!(tone >= 1 && tone <= 5) || !actorKey) return <span className={`dx-py dx-py-plain ${className}`}>{pinyin}</span>
  const syllable = pinyin.split(/[\s,/]+/)[0] ?? pinyin
  const letters = Array.from(syllable)
  const actorLength = finalKey === 'ø' ? letters.length : actorKey === 'ø' ? 0 : Math.min(letters.length, Array.from(actorKey).length)
  const initial = letters.slice(0, actorLength).join('')
  const final = letters.slice(actorLength).join('')
  const detail = getToneDetail(tone)
  return <span className={`dx-py ${className}`} aria-label={`${pinyin}, ${detail?.label ?? ''} tone`} title={`${actorKey}- actor · -${finalKey} set`}>
    {initial ? <span data-k="actor" aria-hidden="true">{initial}</span> : null}
    {final ? <span data-k="set" aria-hidden="true">{final}</span> : null}
    <ToneContour tone={tone} className="dx-py-tone" />
  </span>
}

// Pitch shapes: high level, rising, dipping (a V, like the ˇ mark — a dip-and-rise reads as a ✓), falling.
const contours: Record<number, [number, number][]> = {
  1: [[2, 2], [18, 2]],
  2: [[2, 10], [18, 2]],
  3: [[3, 3], [10, 13], [17, 3]],
  4: [[2, 2], [18, 13]],
}

/** The tone drawn as its pitch shape instead of a number; neutral is a light dot. */
export function ToneContour({ tone, className = '' }: { tone: number; className?: string }) {
  const points = contours[tone]
  return <svg className={`dx-tone ${className}`.trim()} viewBox="0 0 20 15" aria-hidden="true">
    {points ? <polyline points={points.map(point => point.join(',')).join(' ')} /> : <circle cx="10" cy="11" r="2.2" />}
  </svg>
}

export function AudioButton({ text, pinyin, label }: { text: string; pinyin: string; label?: string }) {
  const speech = useMandarinSpeech()
  return <button type="button" className={`dx-audio ${label ? 'dx-audio-labeled' : ''}`.trim()} data-status={speech.status} aria-label={`Play ${text}`}
    onClick={() => void speech.speak(text, pinyin)} disabled={speech.status === 'loading'}>
    {speech.status === 'loading' ? <PixelLoader label="Loading audio" size={3} />
      : <span className="dx-audio-bars" aria-hidden="true"><i /><i /><i /><i /></span>}
    {label ? <span>{label}</span> : null}
  </button>
}

export type UsageWord = { id: string; hanzi: string; pinyin: string; meaning: string; chars: { char: string; target: boolean; known: boolean }[]; unknown: number }

/** Words that use the character, preferring ones built from characters you know. */
const noExtraKnown: ReadonlySet<string> = new Set()
export function useUsage(hanzi: string, alsoKnown = noExtraKnown) {
  const library = useQuery(libraryQueryOptions)
  const result = useMemo(() => {
    if (!library.data) return null
    const known = new Set(library.data.characters.filter(entry => entry.status !== 'new').map(entry => entry.hanzi))
    alsoKnown.forEach(char => known.add(char))
    const words: UsageWord[] = library.data.words
      .filter(word => word.hanzi !== hanzi && word.hanzi.includes(hanzi))
      .map(word => {
        const chars = Array.from(word.hanzi).map(char => ({ char, target: char === hanzi, known: char === hanzi || known.has(char) }))
        return { id: word.id, hanzi: word.hanzi, pinyin: word.pinyin, meaning: word.meaning, chars, unknown: chars.filter(entry => !entry.known).length, rank: word.rank }
      })
      .sort((a, b) => a.unknown - b.unknown || a.rank - b.rank)
      .slice(0, 3)
    return { words }
  }, [library.data, hanzi, alsoKnown])
  return { data: result, pending: library.isPending, error: library.isError, retry: () => void library.refetch() }
}

export function UsageHanzi({ chars }: { chars: UsageWord['chars'] }) {
  return <span className="dx-usage-hanzi font-hanzi" lang="zh-CN">{chars.map((entry, index) => <span key={index} data-target={entry.target} data-known={entry.known}>{entry.char}</span>)}</span>
}
