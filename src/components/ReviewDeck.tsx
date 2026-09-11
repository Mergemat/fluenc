import { useReveal } from '../hooks/useReveal'
import { directCharacters } from '../lib/character-props'
import { getItemMeaning } from '../lib/meaning'
import type { ReviewItem } from '../server/curriculum'
import { CharacterScene } from './character-studio/CharacterScene'
import { characterCues } from './character-studio/cues'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge } from './NeutralToneHint'
import { RecallFrame } from './ui/RecallFrame'
import './character-studio/studio.css'

type RecallItem = Exclude<ReviewItem, { type: 'sentence' }>

export function ReviewDeck({ item, pending, onRate }: { item: RecallItem; pending: boolean; onRate: (rating: number) => void }) {
  const { revealed, reveal } = useReveal({ pending, onRate })
  const meaning = getItemMeaning(item)
  return <RecallFrame revealed={revealed} reveal={reveal} pending={pending} onRate={onRate} ratingHint="Before revealing, did you recall both meaning and pronunciation? If either was missing or wrong, choose Missed something.">
    {revealed && item.type === 'character' ? <div className="review-character cs-studio">
      <CharacterScene studio={{ item, meaning: meaning.primary, cues: characterCues(item) }} direct={directCharacters.has(item.hanzi)} reviewing />
    </div> : <div className="recall-target">
      <p className="study-label">{revealed ? 'Word' : 'Meaning & pronunciation'}</p>
      <p className={`recall-hanzi font-hanzi ${item.type === 'word' ? 'recall-word' : ''}`} lang="zh-CN">{item.hanzi}</p>
      {revealed ? <>
        <div className="answer-sound"><strong>{item.pinyin}</strong><NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} /><MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} /></div>
        <p className="answer-meaning">{meaning.primary}</p>
        {item.type === 'word' && item.livingLink ? <p className="memory-link">{item.livingLink}</p> : null}
      </> : <p className="recall-hint">Recall the meaning and say it aloud, including the tones.</p>}
    </div>}
  </RecallFrame>
}
