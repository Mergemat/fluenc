import type { BuildItem } from '../../server/curriculum'

export type CharacterItem = Extract<BuildItem, { type: 'character' }>
export type CueKind = 'actor' | 'set' | 'room' | 'prop'
export type Cue = {
  id: string
  kind: CueKind
  code: string
  name: string
  role: string
  count?: number
}

