// Prompt and answer share one fixed footprint (the answer replaces placeholder bars of the same
// height), and the reveal button and ratings share one slot, so revealing never moves anything.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Rating } from 'ts-fsrs'

import { getItemMeaning } from '../lib/meaning'
import { getMovieCoordinates } from '../lib/pinyin'
import { wordSyllables } from '../lib/word-syllables'
import { saveReview } from '../offline/progress'
import { useProgressMutation } from '../offline/useProgressMutation'
import type { ReviewItem } from '../server/curriculum'
import { clueCode, lessonClues } from './CharacterLesson'
import { DitherButton } from './dither-kit/button'
import type { DitherColor } from './dither-kit/palette'
import { SentenceReviewDeck } from './SentenceReviewDeck'
import { DitherGradient } from './dither-kit/gradient'
import { partColor } from './ui/Dither'
import { AudioButton, HanziGlyph, MoviePinyin, ToneContour } from './ui/Hanzi'

const ratings: { value: number; label: string; note: string; color: DitherColor }[] = [
  { value: Rating.Again, label: 'again', note: 'missed a part', color: 'red' },
  { value: Rating.Hard, label: 'hard', note: 'with effort', color: 'orange' },
  { value: Rating.Good, label: 'good', note: 'small pause', color: 'blue' },
  { value: Rating.Easy, label: 'easy', note: 'instant', color: 'green' },
]

export function ReviewCard({ item }: { item: ReviewItem }) {
  const startedAt = useRef(Date.now())
  const [revealed, setRevealed] = useState(false)
  const mutation = useProgressMutation(saveReview)
  const rate = (rating: number) => {
    if (mutation.isPending) return
    mutation.mutate({ itemType: item.type, itemId: item.id, rating, durationMs: Math.min(3_600_000, Math.max(0, Date.now() - startedAt.current)) })
  }

  useEffect(() => {
    if (item.type === 'sentence') return
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, button, a, [role=dialog]')) return
      if ((event.code === 'Space' || event.key === 'Enter') && !revealed) { event.preventDefault(); setRevealed(true) }
      else if (revealed && /^[1-4]$/.test(event.key)) rate(Number(event.key))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const error = mutation.isError ? <p className="dx-review-error" role="alert">could not save this review — try again</p> : null
  if (item.type === 'sentence') return <div className="dx-review-legacy"><SentenceReviewDeck item={item} pending={mutation.isPending} onRate={rate} />{error}</div>

  const meaning = getItemMeaning(item)
  const character = item.type === 'character' ? item : null
  const clues = character ? lessonClues(character) : []
  const props = clues.filter(clue => clue.kind === 'prop')

  const word = item.type === 'word' ? item : null
  const syllables = word ? wordSyllables(word.hanzi, word.pinyin) : null

  // Prompt and answer are one centred block; the answer slot is a fixed height.
  return <div className="dx-card" data-revealed={revealed} data-type={item.type}>
    <div className="dx-card-stage">
    {character
      ? <div className="dx-glyph-box"><HanziGlyph hanzi={character.hanzi} parts={props.map(prop => prop.code)} xray={revealed} concealed={!revealed} /></div>
      : word ? <WordGloss hanzi={word.hanzi} syllables={syllables} glosses={word.characterParts.map(part => part.meaning)} revealed={revealed} />
      : null}

    <div className="dx-answer">
      <div className="dx-answer-ghost" aria-hidden="true">
        {(character ? ['meaning', 'sound', 'scene'] : ['meaning', 'use']).map(label => <div key={label}><span>{label}</span><i><DitherGradient from="grey" direction="right" cell={2} opacity={.7} /></i></div>)}
      </div>
      <div className="dx-answer-real" inert={!revealed} aria-hidden={!revealed}>
        <h2 className="dx-meaning">{meaning.primary}</h2>
        {character ? <>
          {meaning.also ? <p className="dx-alt">also {meaning.also}</p> : null}
          <div className="dx-sound"><MoviePinyin pinyin={item.pinyin} tone={character.movie.tone} actorKey={character.movie.actorKey} finalKey={character.movie.finalKey} /><AudioButton text={item.hanzi} pinyin={item.pinyin} /></div>
          <ul className="dx-scene-chips">
            {clues.map(clue => <li key={clue.id} data-kind={clue.kind} style={clue.kind === 'prop' ? { '--part': partColor(clue.partIndex) } as CSSProperties : undefined}>
              <b className={clue.kind === 'prop' ? 'font-hanzi-props' : ''}>{clueCode(clue)}</b>{clue.name || '—'}
            </li>)}
          </ul>
        </> : word ? <>
          {word.livingLink ? <p className="dx-link">{word.livingLink}</p> : <p className="dx-alt">{meaning.also ?? ' '}</p>}
          {syllables ? null : <p className="dx-word-reading">{word.pinyin}</p>}
          <AudioButton text={item.hanzi} pinyin={item.pinyin} label="listen" />
        </> : null}
      </div>
    </div>
    </div>

    <footer className="dx-card-actions">
      <DitherButton className="dx-action" color="blue" variant="gradient" inert={revealed} aria-hidden={revealed} onClick={() => setRevealed(true)}><span>show answer</span><kbd>space</kbd></DitherButton>
      <div className="dx-ratings" role="group" aria-label="How well did you recall it?" inert={!revealed} aria-hidden={!revealed}>
        {ratings.map(rating => {
          const picked = mutation.isPending && mutation.variables?.rating === rating.value
          return <DitherButton key={rating.value} className="dx-rate" color={rating.color} variant={picked ? 'solid' : 'dotted'} data-picked={picked} bloom={picked ? 'high' : 'off'}
            disabled={mutation.isPending && !picked} onClick={() => rate(rating.value)}>
            <span>{rating.label}</span><small>{rating.note}</small><kbd>{rating.value}</kbd>
          </DitherButton>
        })}
      </div>
    </footer>
    {error}
  </div>
}

/** A word glossed interlinearly: each character with its syllable above and its keyword below. */
export function WordGloss({ hanzi, syllables, glosses, revealed }: { hanzi: string; syllables: string[] | null; glosses: string[]; revealed: boolean }) {
  const characters = Array.from(hanzi)
  return <div className="dx-gloss" data-revealed={revealed} lang="zh-CN">
    {characters.map((char, index) => {
      const syllable = syllables?.[index]
      return <div key={index} className="dx-gloss-col">
        <span className="dx-gloss-py" aria-hidden={!revealed} lang="zh-Latn">{syllable ? <>{syllable}<ToneContour tone={getMovieCoordinates(syllable).tone} /></> : ' '}</span>
        <span className="dx-gloss-hanzi font-hanzi">{char}</span>
        <span className="dx-gloss-en" aria-hidden={!revealed} lang="en">{characters.length > 1 ? glosses[index] ?? '' : ' '}</span>
      </div>
    })}
  </div>
}
