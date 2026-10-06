import { isStudyItemType } from "../data/types";
import {
  type CardSnapshot,
  cardKey,
  emptyLearnerState,
  type LearnerState,
} from "../lib/learner-state";
import { defaultToneRooms } from "../lib/pinyin";

/** Snapshot keys written before devices stored learner state; read once to migrate offline progress. */
export const legacyCacheKeys = [
  "lessons-v3:dashboard",
  "lessons-v3:library",
  "lessons-v3:palace",
] as const;

interface Named {
  key: string;
  name: string;
}
interface LegacyMovie {
  actorKey: string;
  actorName: string;
  components: { hanzi: string; propName: string }[];
  finalKey: string;
  roomName: string;
  setName: string;
  tone: number;
}
interface LegacyItem {
  card?: CardSnapshot;
  id: string;
  livingLink?: string;
  movie?: LegacyMovie;
  type: string;
}
interface LegacyDashboard {
  buildQueue: LegacyItem[];
  lockedWords?: LegacyItem[];
  reviewQueue: LegacyItem[];
  scheduledQueue: LegacyItem[];
}
interface LegacyLibrary {
  words: { id: string; livingLink?: string }[];
}
interface LegacyPalace {
  actors: Named[];
  props: Named[];
  rooms: { tone: number; name: string }[];
  sets: Named[];
}

/** Record a name the learner chose; empty names and the default room names stay unset. */
function keepName(
  names: Record<string, string>,
  key: string | number,
  name: string,
  fallback?: string
) {
  if (name && name !== fallback) {
    names[key] = name;
  }
}

function keepMovieNames(state: LearnerState, movie: LegacyMovie) {
  keepName(state.actors, movie.actorKey, movie.actorName);
  keepName(state.sets, movie.finalKey, movie.setName);
  keepName(
    state.rooms,
    movie.tone,
    movie.roomName,
    defaultToneRooms[movie.tone]
  );
  for (const component of movie.components) {
    keepName(state.props, component.hanzi, component.propName);
  }
}

function keepPalaceNames(state: LearnerState, palace: LegacyPalace) {
  for (const actor of palace.actors) {
    keepName(state.actors, actor.key, actor.name);
  }
  for (const set of palace.sets) {
    keepName(state.sets, set.key, set.name);
  }
  for (const room of palace.rooms) {
    keepName(state.rooms, room.tone, room.name, defaultToneRooms[room.tone]);
  }
  for (const prop of palace.props) {
    keepName(state.props, prop.key, prop.name);
  }
}

/**
 * Rebuild learner state from the old dashboard, library and palace snapshots. Introduced cards
 * carried their full schedule, and names and stories appear on the items that use them.
 */
export function learnerStateFromLegacy(
  dashboard: LegacyDashboard,
  library?: LegacyLibrary | null,
  palace?: LegacyPalace | null
): LearnerState {
  const state = structuredClone(emptyLearnerState);
  for (const item of [...dashboard.reviewQueue, ...dashboard.scheduledQueue]) {
    if (isStudyItemType(item.type) && item.card) {
      state.cards[cardKey(item.type, item.id)] = item.card;
    }
  }
  const items = [
    ...dashboard.reviewQueue,
    ...dashboard.scheduledQueue,
    ...dashboard.buildQueue,
    ...(dashboard.lockedWords ?? []),
  ];
  for (const { movie, type, id, livingLink } of items) {
    if (type === "word" && livingLink) {
      state.livingLinks[id] = livingLink;
    }
    if (movie) {
      keepMovieNames(state, movie);
    }
  }
  for (const word of library?.words ?? []) {
    keepName(state.livingLinks, word.id, word.livingLink ?? "");
  }
  if (palace) {
    keepPalaceNames(state, palace);
  }
  return state;
}
