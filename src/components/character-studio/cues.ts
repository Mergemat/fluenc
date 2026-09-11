import { directCharacters } from '../../lib/character-props'
import type { CharacterItem, Cue } from './types'

const actorLabels = { male: 'Male actor', female: 'Female actor', fictional: 'Fictional actor', wildcard: 'Wildcard actor' }

export function characterCues(item: Pick<CharacterItem, 'hanzi' | 'movie'>): Cue[] {
  if (directCharacters.has(item.hanzi)) return [
    { id: 'prop', kind: 'prop', code: item.hanzi, name: item.movie.components.find(part => part.hanzi === item.hanzi)?.propName ?? '', role: 'Reusable prop' },
  ]
  return [
    { id: 'actor', kind: 'actor', code: item.movie.actorKey, name: item.movie.actorName, role: actorLabels[item.movie.actorCategory] },
    { id: 'set', kind: 'set', code: item.movie.finalKey, name: item.movie.setName, role: 'Place code' },
    { id: 'room', kind: 'room', code: String(item.movie.tone), name: item.movie.roomName, role: 'Tone room' },
    ...item.movie.components.map((part, index): Cue => ({ id: `prop-${index}`, kind: 'prop', code: part.hanzi, name: part.propName, count: part.count, role: 'Prop' })),
  ]
}
