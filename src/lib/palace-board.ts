import type { LibraryData, PalaceData } from '../server/curriculum'
import { componentMeanings } from './component-meanings'
import type { MovieCoordinates } from './pinyin'
import { defaultToneRooms } from './pinyin'

export type ActorCategory = MovieCoordinates['actorCategory']
type Usage = { characters: number; started: number; ids: string[] }
export type BoardActor = Usage & { key: string; category: ActorCategory; name: string }
export type BoardSet = Usage & { key: string; name: string }
export type BoardRoom = Usage & { tone: number; name: string }
export type BoardProp = Usage & { key: string; name: string; meaning: string | null }

export const actorCategories: { id: ActorCategory; label: string }[] = [
  { id: 'male', label: 'male actors' },
  { id: 'female', label: 'female actors' },
  { id: 'fictional', label: 'fictional characters' },
  { id: 'wildcard', label: 'gods & world leaders' },
]

/**
 * The learner's whole Hanzi Movie Method system: every actor, set, tone area and prop the course
 * uses, what they named it, and how many characters (and started characters) rely on it.
 */
export function buildPalaceBoard(library: LibraryData, palace: PalaceData) {
  const actors = new Map<string, BoardActor>()
  const sets = new Map<string, BoardSet>()
  const rooms = new Map<number, BoardRoom>()
  const props = new Map<string, BoardProp>()
  const keywords = new Map(library.characters.map(character => [character.hanzi, character.keyword]))
  const named = <T extends { key: string; name: string }>(entries: T[], key: string) => entries.find(entry => entry.key === key)?.name ?? ''
  const count = (usage: Usage, id: string, started: boolean) => { usage.characters += 1; usage.ids.push(id); if (started) usage.started += 1 }

  // Course order, so each clue's characters list from most to least frequent.
  for (const character of [...library.characters].sort((a, b) => a.rank - b.rank)) {
    const started = character.status !== 'new'
    const { actorKey, finalKey, tone, actorCategory } = character.movie
    // Single-component lessons (一, 二, 三) are learned as props, without a sound scene.
    const scene = !(character.components.length === 1 && character.components[0].hanzi === character.hanzi)
    if (scene) {
      if (!actors.has(actorKey)) actors.set(actorKey, { key: actorKey, category: actorCategory, name: named(palace.actors, actorKey), characters: 0, started: 0, ids: [] })
      if (!sets.has(finalKey)) sets.set(finalKey, { key: finalKey, name: named(palace.sets, finalKey), characters: 0, started: 0, ids: [] })
      if (!rooms.has(tone)) rooms.set(tone, { tone, name: palace.rooms.find(room => room.tone === tone)?.name ?? defaultToneRooms[tone] ?? '', characters: 0, started: 0, ids: [] })
      count(actors.get(actorKey)!, character.id, started)
      count(sets.get(finalKey)!, character.id, started)
      count(rooms.get(tone)!, character.id, started)
    }
    for (const part of character.components) {
      if (!props.has(part.hanzi)) props.set(part.hanzi, { key: part.hanzi, name: named(palace.props, part.hanzi), meaning: keywords.get(part.hanzi) ?? componentMeanings[part.hanzi] ?? null, characters: 0, started: 0, ids: [] })
      count(props.get(part.hanzi)!, character.id, started)
    }
  }

  const byUse = (a: Usage & { key?: string }, b: Usage & { key?: string }) => b.characters - a.characters || (a.key ?? '').localeCompare(b.key ?? '')
  return {
    actors: [...actors.values()].sort((a, b) => a.key.localeCompare(b.key)),
    sets: [...sets.values()].sort(byUse),
    rooms: [...rooms.values()].sort((a, b) => a.tone - b.tone),
    props: [...props.values()].sort(byUse),
  }
}

export type PalaceBoard = ReturnType<typeof buildPalaceBoard>

export type ClueKind = 'cast' | 'sets' | 'areas' | 'props'

/** Find one clue on the board by its route kind and key. */
export function findClue(board: PalaceBoard, kind: ClueKind, key: string) {
  if (kind === 'cast') return board.actors.find(actor => actor.key === key)
  if (kind === 'sets') return board.sets.find(set => set.key === key)
  if (kind === 'areas') return board.rooms.find(room => String(room.tone) === key)
  return board.props.find(prop => prop.key === key)
}
