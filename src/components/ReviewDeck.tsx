import { useReveal } from '../hooks/useReveal'
import { directCharacters } from '../lib/character-props'
import { getItemMeaning } from '../lib/meaning'
import type { ReviewItem } from '../server/curriculum'
import { CharacterScene } from './character-studio/CharacterScene'
import { characterCues } from './character-studio/cues'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge } from './NeutralToneHint'
import { RecallAnswer } from './ui/RecallAnswer'
import { RecallFrame } from './ui/RecallFrame'
import './character-studio/studio.css'

type RecallItem = Exclude<ReviewItem, { type: 'sentence' }>

export function ReviewDeck({ item, pending, onRate }: { item: RecallItem; pending: boolean; onRate: (rating: number) => void }) {
  const { revealed, reveal } = useReveal({ pending, onRate })
  const meaning = getItemMeaning(item).summary
  return <RecallFrame revealed={revealed} reveal={reveal} pending={pending} onRate={onRate}>
    {item.type === 'character' ? <div className="review-character cs-studio">
      <CharacterScene studio={{ item, meaning, cues: characterCues(item) }} direct={directCharacters.has(item.hanzi)} reviewing concealed={!revealed} />
    </div> : <div className="recall-target">
      <p className="study-label">Meaning & pronunciation</p>
      <p className="recall-hanzi recall-word font-hanzi" lang="zh-CN">{item.hanzi}</p>
      <RecallAnswer revealed={revealed} hint="Recall the meaning and say it aloud, including the tones.">
        <div className="answer-sound"><strong>{item.pinyin}</strong><NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} /><MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} /></div>
        <p className="answer-meaning">{meaning}</p>
        {item.livingLink ? <p className="memory-link">{item.livingLink}</p> : null}
      </RecallAnswer>
    </div>}
  </RecallFrame>
}
