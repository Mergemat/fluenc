import { isStudyItemType } from '../data/types'
import { cardKey, emptyLearnerState, type CardSnapshot, type LearnerState } from '../lib/learner-state'
import { defaultToneRooms } from '../lib/pinyin'

/** Snapshot keys written before devices stored learner state; read once to migrate offline progress. */
export const legacyCacheKeys = ['lessons-v3:dashboard', 'lessons-v3:library', 'lessons-v3:palace'] as const

type Named = { key: string; name: string }
type LegacyMovie = {
  actorKey: string; actorName: string; finalKey: string; setName: string; tone: number; roomName: string
  components: { hanzi: string; propName: string }[]
}
type LegacyItem = { type: string; id: string; card?: CardSnapshot; movie?: LegacyMovie; livingLink?: string }
type LegacyDashboard = { reviewQueue: LegacyItem[]; scheduledQueue: LegacyItem[]; buildQueue: LegacyItem[]; lockedWords?: LegacyItem[] }
type LegacyLibrary = { words: { id: string; livingLink?: string }[] }
type LegacyPalace = { actors: Named[]; sets: Named[]; rooms: { tone: number; name: string }[]; props: Named[] }

/**
 * Rebuild learner state from the old dashboard, library and palace snapshots. Introduced cards
 * carried their full schedule, and names and stories appear on the items that use them.
 */
export function learnerStateFromLegacy(dashboard: LegacyDashboard, library?: LegacyLibrary | null, palace?: LegacyPalace | null): LearnerState {
  const state = structuredClone(emptyLearnerState)
  const items = [...dashboard.reviewQueue, ...dashboard.scheduledQueue, ...dashboard.buildQueue, ...dashboard.lockedWords ?? []]
  for (const item of [...dashboard.reviewQueue, ...dashboard.scheduledQueue]) {
    if (isStudyItemType(item.type) && item.card) state.cards[cardKey(item.type, item.id)] = item.card
  }
  for (const { movie, type, id, livingLink } of items) {
    if (type === 'word' && livingLink) state.livingLinks[id] = livingLink
    if (!movie) continue
    if (movie.actorName) state.actors[movie.actorKey] = movie.actorName
    if (movie.setName) state.sets[movie.finalKey] = movie.setName
    if (movie.roomName && movie.roomName !== defaultToneRooms[movie.tone]) state.rooms[movie.tone] = movie.roomName
    for (const component of movie.components) if (component.propName) state.props[component.hanzi] = component.propName
  }
  for (const word of library?.words ?? []) if (word.livingLink) state.livingLinks[word.id] = word.livingLink
  if (palace) {
    for (const actor of palace.actors) if (actor.name) state.actors[actor.key] = actor.name
    for (const set of palace.sets) if (set.name) state.sets[set.key] = set.name
    for (const room of palace.rooms) if (room.name && room.name !== defaultToneRooms[room.tone]) state.rooms[room.tone] = room.name
    for (const prop of palace.props) if (prop.name) state.props[prop.key] = prop.name
  }
  return state
}
