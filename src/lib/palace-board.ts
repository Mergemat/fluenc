import { componentMeanings } from "./component-meanings";
import type { LibraryData, PalaceData } from "./learner-views";
import type { MovieCoordinates } from "./pinyin";
import { defaultToneRooms } from "./pinyin";

export type ActorCategory = MovieCoordinates["actorCategory"];
interface Usage {
  characters: number;
  ids: string[];
  started: number;
}
export type BoardActor = Usage & {
  key: string;
  category: ActorCategory;
  name: string;
};
export type BoardSet = Usage & { key: string; name: string };
export type BoardRoom = Usage & { tone: number; name: string };
export type BoardProp = Usage & {
  key: string;
  name: string;
  meaning: string | null;
};

export const actorCategories: { id: ActorCategory; label: string }[] = [
  { id: "male", label: "male actors" },
  { id: "female", label: "female actors" },
  { id: "fictional", label: "fictional characters" },
  { id: "wildcard", label: "gods & world leaders" },
];

/**
 * The learner's whole Hanzi Movie Method system: every actor, set, tone area and prop the course
 * uses, what they named it, and how many characters (and started characters) rely on it.
 */
/** The usage entry for a key, created on first use. */
function usageFor<K, V extends Usage>(map: Map<K, V>, key: K, create: () => V) {
  let usage = map.get(key);
  if (!usage) {
    usage = create();
    map.set(key, usage);
  }
  return usage;
}

function count(usage: Usage, id: string, started: boolean) {
  usage.characters += 1;
  usage.ids.push(id);
  if (started) {
    usage.started += 1;
  }
}

const unused = () => ({ characters: 0, started: 0, ids: [] as string[] });

/**
 * The learner's whole Hanzi Movie Method system: every actor, set, tone area and prop the course
 * uses, what they named it, and how many characters (and started characters) rely on it.
 */
export function buildPalaceBoard(library: LibraryData, palace: PalaceData) {
  const actors = new Map<string, BoardActor>();
  const sets = new Map<string, BoardSet>();
  const rooms = new Map<number, BoardRoom>();
  const props = new Map<string, BoardProp>();
  const keywords = new Map(
    library.characters.map((character) => [character.hanzi, character.keyword])
  );
  const names = (entries: { key: string; name: string }[]) =>
    new Map(entries.map((entry) => [entry.key, entry.name]));
  const actorNames = names(palace.actors);
  const setNames = names(palace.sets);
  const propNames = names(palace.props);
  const roomNames = new Map(palace.rooms.map((room) => [room.tone, room.name]));

  // Course order, so each clue's characters list from most to least frequent.
  for (const character of [...library.characters].sort(
    (a, b) => a.rank - b.rank
  )) {
    const started = character.status !== "new";
    const { actorKey, finalKey, tone, actorCategory } = character.movie;
    // Single-component lessons (一, 二, 三) are learned as props, without a sound scene.
    const scene = !(
      character.components.length === 1 &&
      character.components[0].hanzi === character.hanzi
    );
    if (scene) {
      const actor = usageFor(actors, actorKey, () => ({
        key: actorKey,
        category: actorCategory,
        name: actorNames.get(actorKey) ?? "",
        ...unused(),
      }));
      const set = usageFor(sets, finalKey, () => ({
        key: finalKey,
        name: setNames.get(finalKey) ?? "",
        ...unused(),
      }));
      const room = usageFor(rooms, tone, () => ({
        tone,
        name: roomNames.get(tone) ?? defaultToneRooms[tone] ?? "",
        ...unused(),
      }));
      for (const usage of [actor, set, room]) {
        count(usage, character.id, started);
      }
    }
    for (const part of character.components) {
      const prop = usageFor(props, part.hanzi, () => ({
        key: part.hanzi,
        name: propNames.get(part.hanzi) ?? "",
        meaning:
          keywords.get(part.hanzi) ?? componentMeanings[part.hanzi] ?? null,
        ...unused(),
      }));
      count(prop, character.id, started);
    }
  }

  const byUse = (a: Usage & { key?: string }, b: Usage & { key?: string }) =>
    b.characters - a.characters || (a.key ?? "").localeCompare(b.key ?? "");
  return {
    actors: [...actors.values()].sort((a, b) => a.key.localeCompare(b.key)),
    sets: [...sets.values()].sort(byUse),
    rooms: [...rooms.values()].sort((a, b) => a.tone - b.tone),
    props: [...props.values()].sort(byUse),
  };
}

export type PalaceBoard = ReturnType<typeof buildPalaceBoard>;

export type ClueKind = "cast" | "sets" | "areas" | "props";

/** Find one clue on the board by its route kind and key. */
export function findClue(board: PalaceBoard, kind: ClueKind, key: string) {
  if (kind === "cast") {
    return board.actors.find((actor) => actor.key === key);
  }
  if (kind === "sets") {
    return board.sets.find((set) => set.key === key);
  }
  if (kind === "areas") {
    return board.rooms.find((room) => String(room.tone) === key);
  }
  return board.props.find((prop) => prop.key === key);
}
