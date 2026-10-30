import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  max,
  type SQL,
  sql,
} from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import wordCharacters from "../data/character-words.generated.json";
import type { FocusEntry } from "../data/types";
import { db } from "../db";
import {
  componentProps,
  events,
  focusEntries,
  type LearnerItem,
  learnerItems,
  learners,
  mnemonics,
  palaceActors,
  palaceSets,
  toneRooms,
} from "../db/schema";
import { studyIdentity } from "../lib/character-words";
import {
  applyOperation,
  applyPatch,
  type CardSnapshot,
  cardKey,
  emptyLearnerState,
  focusKey,
  type LearnerPatch,
  type LearnerState,
  type ProgressOperation,
  parseCardKey,
} from "../lib/learner-state";
import { wordSyllables } from "../lib/word-syllables";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Database | Transaction;

function cardSnapshot(item: LearnerItem): CardSnapshot {
  return {
    due: item.due.toISOString(),
    stability: item.stability,
    difficulty: item.difficulty,
    elapsedDays: item.elapsedDays,
    scheduledDays: item.scheduledDays,
    learningSteps: item.learningSteps,
    reps: item.reps,
    lapses: item.lapses,
    state: item.state,
    lastReview: item.lastReview?.toISOString() ?? null,
    introducedAt: item.introducedAt.toISOString(),
  };
}

function focusEntry(row: typeof focusEntries.$inferSelect): FocusEntry {
  return {
    kind: row.kind,
    hanzi: row.hanzi,
    pinyin: row.pinyin,
    meaning: row.meaning,
    label: row.label,
    addedAt: row.addedAt.toISOString(),
    ...(row.kind === "word"
      ? { syllables: wordSyllables(row.hanzi, row.pinyin) }
      : {}),
  };
}

const names = <Row>(
  rows: Row[],
  key: (row: Row) => string | number,
  name: (row: Row) => string
) => Object.fromEntries(rows.map((row) => [key(row), name(row)]));

/** Upsert columns: on a conflict, take the new row's value. */
function excluded<T extends SQLiteTable>(
  table: T,
  columns: (keyof T["$inferInsert"])[]
) {
  return Object.fromEntries(
    columns.map((column) => {
      const { name } = table[column as keyof T] as unknown as SQLiteColumn;
      return [column, sql`excluded.${sql.identifier(name)}`];
    })
  ) as Record<keyof T["$inferInsert"], SQL>;
}

const noChanges: LearnerPatch = {
  cards: {},
  actors: {},
  sets: {},
  rooms: {},
  props: {},
  livingLinks: {},
  focus: [],
  removedFocus: [],
};

const readHead = (reader: Reader, learnerId: string) =>
  reader
    .select({ seq: max(events.seq) })
    .from(events)
    .where(eq(events.learnerId, learnerId));

/**
 * Rows changed after `cursor`, with the cursor that covers them; a null cursor reads everything.
 * One batch, so the rows and the cursor are read from the same moment.
 */
export async function readPatch(learnerId: string, cursor: number | null) {
  // Most syncs are a device checking in with nothing new: one indexed read answers them.
  if (cursor !== null) {
    const [head] = await readHead(db, learnerId);
    if ((head?.seq ?? 0) === cursor) {
      return { cursor, patch: noChanges };
    }
  }
  const since = cursor ?? -1;
  const [head, items, actors, sets, rooms, props, links, focus] =
    await db.batch([
      readHead(db, learnerId),
      db
        .select()
        .from(learnerItems)
        .where(
          and(
            eq(learnerItems.learnerId, learnerId),
            gt(learnerItems.version, since)
          )
        ),
      db
        .select()
        .from(palaceActors)
        .where(
          and(
            eq(palaceActors.learnerId, learnerId),
            gt(palaceActors.version, since)
          )
        ),
      db
        .select()
        .from(palaceSets)
        .where(
          and(
            eq(palaceSets.learnerId, learnerId),
            gt(palaceSets.version, since)
          )
        ),
      db
        .select()
        .from(toneRooms)
        .where(
          and(eq(toneRooms.learnerId, learnerId), gt(toneRooms.version, since))
        ),
      db
        .select()
        .from(componentProps)
        .where(
          and(
            eq(componentProps.learnerId, learnerId),
            gt(componentProps.version, since)
          )
        ),
      db
        .select()
        .from(mnemonics)
        .where(
          and(
            eq(mnemonics.learnerId, learnerId),
            eq(mnemonics.itemType, "word"),
            gt(mnemonics.version, since)
          )
        ),
      db
        .select()
        .from(focusEntries)
        .where(
          and(
            eq(focusEntries.learnerId, learnerId),
            gt(focusEntries.version, since),
            // A first sync has nothing to remove.
            cursor === null ? isNull(focusEntries.removedAt) : undefined
          )
        )
        .orderBy(asc(focusEntries.addedAt)),
    ]);
  const patch: LearnerPatch = {
    cards: Object.fromEntries(
      items.map((item) => [
        cardKey(item.itemType, item.itemId),
        cardSnapshot(item),
      ])
    ),
    actors: names(
      actors,
      (row) => row.actorKey,
      (row) => row.actorName
    ),
    sets: names(
      sets,
      (row) => row.finalKey,
      (row) => row.setName
    ),
    rooms: names(
      rooms,
      (row) => row.tone,
      (row) => row.roomName
    ),
    props: names(
      props,
      (row) => row.component,
      (row) => row.propName
    ),
    livingLinks: names(
      links,
      (row) => row.itemId,
      (row) => row.story
    ),
    focus: focus.filter((row) => !row.removedAt).map(focusEntry),
    removedFocus: focus.filter((row) => row.removedAt).map(focusKey),
  };
  return { cursor: head[0]?.seq ?? 0, patch };
}

/** Everything the server keeps for a learner. */
export async function readLearnerState(learnerId: string) {
  const { patch } = await readPatch(learnerId, null);
  return applyPatch(emptyLearnerState, patch, true);
}

function targetCardKey(operation: ProgressOperation) {
  if (
    operation.kind !== "enroll" &&
    operation.kind !== "review" &&
    operation.kind !== "undo"
  ) {
    return null;
  }
  const target = studyIdentity(operation.data.itemType, operation.data.itemId);
  return cardKey(target.itemType, target.itemId);
}

/** Just the rows a set of changes reads: the cards they touch, and focus when they use it. */
async function readTargets(
  reader: Reader,
  learnerId: string,
  operations: ProgressOperation[]
): Promise<LearnerState> {
  const targets = [
    ...new Set(
      operations.flatMap((operation) => targetCardKey(operation) ?? [])
    ),
  ].flatMap((key) => parseCardKey(key) ?? []);
  // One statement at a time: a transaction runs them in order anyway.
  const items = targets.length
    ? await reader
        .select()
        .from(learnerItems)
        .where(
          and(
            eq(learnerItems.learnerId, learnerId),
            // A row value, so each card is one primary key lookup rather than a scan.
            sql`(${learnerItems.itemType}, ${learnerItems.itemId}) in (values ${sql.join(
              targets.map(({ type, id }) => sql`(${type}, ${id})`),
              sql`, `
            )})`
          )
        )
    : [];
  const cards = Object.fromEntries(
    items.map((item) => [
      cardKey(item.itemType, item.itemId),
      cardSnapshot(item),
    ])
  );
  // Focus changes edit the list, and it adds to the catalog that decides what an enroll may add.
  // A late card replays its stored enrolls, so it needs the catalog too. Reviews need neither.
  const usesFocus =
    operations.some(
      (operation) => operation.kind === "enroll" || operation.kind === "focus"
    ) || lateCards({ ...emptyLearnerState, cards }, operations).size > 0;
  const focus = usesFocus
    ? await reader
        .select()
        .from(focusEntries)
        .where(
          and(
            eq(focusEntries.learnerId, learnerId),
            isNull(focusEntries.removedAt)
          )
        )
        .orderBy(asc(focusEntries.addedAt))
    : [];
  return { ...emptyLearnerState, cards, focus: focus.map(focusEntry) };
}

/** Word ids studied as each character, so a character's events can be found by item id. */
const wordsByCharacter: Record<string, string[]> = {};
for (const [wordId, characterId] of Object.entries(
  wordCharacters as Record<string, string>
)) {
  wordsByCharacter[characterId] = [
    ...(wordsByCharacter[characterId] ?? []),
    wordId,
  ];
}

/**
 * Cards a change arrived for after a later one: a review older than the card's last, or an enroll
 * older than its introduction. Applied now, it would land out of order. An undo's card is rebuilt
 * too, since the review it takes back may not be the card's last.
 */
function lateCards(state: LearnerState, operations: ProgressOperation[]) {
  const late = new Set<string>();
  for (const operation of operations) {
    const key = targetCardKey(operation);
    const card = key ? state.cards[key] : undefined;
    if (!(key && card)) {
      continue;
    }
    const reviewedEarlier =
      operation.kind === "review" &&
      card.lastReview !== null &&
      operation.data.reviewedAt < card.lastReview;
    const enrolledEarlier =
      operation.kind === "enroll" &&
      card.introducedAt !== undefined &&
      operation.data.enrolledAt < card.introducedAt;
    if (reviewedEarlier || enrolledEarlier || operation.kind === "undo") {
      late.add(key);
    }
  }
  return late;
}

/** A change's times, no later than `now`: a device whose clock runs ahead cannot date the future. */
function notAfter(operation: ProgressOperation, now: Date): ProgressOperation {
  const latest = now.toISOString();
  const clamp = (time: string) =>
    new Date(time) > now ? latest : new Date(time).toISOString();
  const at = clamp(operation.at);
  if (operation.kind === "review") {
    return {
      ...operation,
      at,
      data: { ...operation.data, reviewedAt: clamp(operation.data.reviewedAt) },
    };
  }
  if (operation.kind === "enroll") {
    return {
      ...operation,
      at,
      data: { ...operation.data, enrolledAt: clamp(operation.data.enrolledAt) },
    };
  }
  return { ...operation, at };
}

/** When each name and story in a set of changes was chosen; the last change to a name wins. */
interface NameTimes {
  actors: Record<string, Date>;
  livingLinks: Record<string, Date>;
  props: Record<string, Date>;
  rooms: Record<string, Date>;
  sets: Record<string, Date>;
}

function nameTimes(operations: ProgressOperation[]): NameTimes {
  const times: NameTimes = {
    actors: {},
    sets: {},
    rooms: {},
    props: {},
    livingLinks: {},
  };
  for (const operation of operations) {
    const at = new Date(operation.at);
    if (operation.kind === "livingLink") {
      times.livingLinks[operation.data.wordId] = at;
    }
    if (operation.kind === "movie") {
      const { actorKey, finalKey, tone, props } = operation.data;
      times.actors[actorKey] = at;
      times.sets[finalKey] = at;
      times.rooms[tone] = at;
      for (const prop of props) {
        times.props[prop.component] = at;
      }
    }
  }
  return times;
}

/** An upsert condition: replace the stored row only with a change made at or after it. */
const isNewer = (column: SQLiteColumn) =>
  sql`excluded.${sql.identifier(column.name)} >= ${column}`;

/**
 * Rebuild cards from every enroll and review stored for them, in the order they were made, less
 * the reviews taken back. An enroll comes first even if its device's clock says otherwise, so no
 * review is dropped.
 */
async function replayCards(
  transaction: Transaction,
  learnerId: string,
  keys: Set<string>,
  state: LearnerState
): Promise<LearnerState> {
  const itemIds = [...keys].flatMap((key) => {
    const target = parseCardKey(key);
    if (!target) {
      return [];
    }
    return target.type === "character"
      ? [target.id, ...(wordsByCharacter[target.id] ?? [])]
      : [target.id];
  });
  const rows = await transaction
    .select()
    .from(events)
    .where(
      and(
        eq(events.learnerId, learnerId),
        inArray(events.kind, ["enroll", "review", "undo"]),
        inArray(sql`json_extract(${events.data}, '$.itemId')`, itemIds)
      )
    )
    .orderBy(asc(events.createdAt), asc(events.seq));
  const stored = rows
    .map(
      (row) =>
        ({
          id: row.id,
          at: row.createdAt.toISOString(),
          kind: row.kind,
          data: row.data,
        }) as ProgressOperation
    )
    .filter((operation) => keys.has(targetCardKey(operation) ?? ""));
  const enrolls = stored.filter((operation) => operation.kind === "enroll");
  const undone = new Set(
    stored.flatMap((operation) =>
      operation.kind === "undo" ? [operation.data.reviewId] : []
    )
  );
  const reviews = stored.filter(
    (operation) => operation.kind === "review" && !undone.has(operation.id)
  );
  const cards = Object.fromEntries(
    Object.entries(state.cards).filter(([key]) => !keys.has(key))
  );
  return [...enrolls, ...reviews].reduce(
    (next, operation) => applyOperation(next, operation),
    { ...state, cards }
  );
}

const changedEntries = <T>(
  after: Record<string, T>,
  before: Record<string, T>
) => Object.entries(after).filter(([key, value]) => before[key] !== value);

/** Write what changed between two states, marking each row with `version`. */
async function writeChanges(
  transaction: Transaction,
  learnerId: string,
  before: LearnerState,
  after: LearnerState,
  changed: NameTimes,
  version: number
) {
  const writes: PromiseLike<unknown>[] = [];
  const cards = changedEntries(after.cards, before.cards).flatMap(
    ([key, card]) => {
      const target = parseCardKey(key);
      return target ? [{ ...target, card }] : [];
    }
  );
  if (cards.length) {
    writes.push(
      transaction
        .insert(learnerItems)
        .values(
          cards.map(({ type, id, card }) => ({
            learnerId,
            itemType: type,
            itemId: id,
            due: new Date(card.due),
            stability: card.stability,
            difficulty: card.difficulty,
            elapsedDays: card.elapsedDays,
            scheduledDays: card.scheduledDays,
            learningSteps: card.learningSteps,
            reps: card.reps,
            lapses: card.lapses,
            state: card.state,
            lastReview: card.lastReview ? new Date(card.lastReview) : null,
            introducedAt: new Date(card.introducedAt ?? card.due),
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [
            learnerItems.learnerId,
            learnerItems.itemType,
            learnerItems.itemId,
          ],
          set: excluded(learnerItems, [
            "due",
            "stability",
            "difficulty",
            "elapsedDays",
            "scheduledDays",
            "learningSteps",
            "reps",
            "lapses",
            "state",
            "lastReview",
            "introducedAt",
            "version",
          ]),
        })
    );
  }

  const actors = changedEntries(after.actors, before.actors);
  if (actors.length) {
    writes.push(
      transaction
        .insert(palaceActors)
        .values(
          actors.map(([actorKey, actorName]) => ({
            learnerId,
            actorKey,
            actorName,
            changedAt: changed.actors[actorKey],
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [palaceActors.learnerId, palaceActors.actorKey],
          set: excluded(palaceActors, ["actorName", "changedAt", "version"]),
          setWhere: isNewer(palaceActors.changedAt),
        })
    );
  }
  const sets = changedEntries(after.sets, before.sets);
  if (sets.length) {
    writes.push(
      transaction
        .insert(palaceSets)
        .values(
          sets.map(([finalKey, setName]) => ({
            learnerId,
            finalKey,
            setName,
            changedAt: changed.sets[finalKey],
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [palaceSets.learnerId, palaceSets.finalKey],
          set: excluded(palaceSets, ["setName", "changedAt", "version"]),
          setWhere: isNewer(palaceSets.changedAt),
        })
    );
  }
  const rooms = changedEntries(after.rooms, before.rooms);
  if (rooms.length) {
    writes.push(
      transaction
        .insert(toneRooms)
        .values(
          rooms.map(([tone, roomName]) => ({
            learnerId,
            tone: Number(tone),
            roomName,
            changedAt: changed.rooms[tone],
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [toneRooms.learnerId, toneRooms.tone],
          set: excluded(toneRooms, ["roomName", "changedAt", "version"]),
          setWhere: isNewer(toneRooms.changedAt),
        })
    );
  }
  const props = changedEntries(after.props, before.props);
  if (props.length) {
    writes.push(
      transaction
        .insert(componentProps)
        .values(
          props.map(([component, propName]) => ({
            learnerId,
            component,
            propName,
            changedAt: changed.props[component],
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [componentProps.learnerId, componentProps.component],
          set: excluded(componentProps, ["propName", "changedAt", "version"]),
          setWhere: isNewer(componentProps.changedAt),
        })
    );
  }
  const links = changedEntries(after.livingLinks, before.livingLinks);
  if (links.length) {
    writes.push(
      transaction
        .insert(mnemonics)
        .values(
          links.map(([itemId, story]) => ({
            learnerId,
            itemType: "word" as const,
            itemId,
            story,
            updatedAt: changed.livingLinks[itemId],
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [mnemonics.learnerId, mnemonics.itemType, mnemonics.itemId],
          set: excluded(mnemonics, ["story", "updatedAt", "version"]),
          setWhere: isNewer(mnemonics.updatedAt),
        })
    );
  }

  if (after.focus !== before.focus) {
    const kept = new Set(after.focus.map(focusKey));
    const existing = new Set(before.focus.map(focusKey));
    const added = after.focus.filter((entry) => !existing.has(focusKey(entry)));
    const removed = before.focus.filter((entry) => !kept.has(focusKey(entry)));
    if (added.length) {
      writes.push(
        transaction
          .insert(focusEntries)
          .values(
            added.map((entry) => ({
              learnerId,
              kind: entry.kind,
              hanzi: entry.hanzi,
              pinyin: entry.pinyin,
              meaning: entry.meaning,
              label: entry.label,
              addedAt: new Date(entry.addedAt),
              removedAt: null,
              version,
            }))
          )
          // A removed entry added again comes back with its new place and label.
          .onConflictDoUpdate({
            target: [
              focusEntries.learnerId,
              focusEntries.kind,
              focusEntries.hanzi,
            ],
            set: excluded(focusEntries, [
              "pinyin",
              "meaning",
              "label",
              "addedAt",
              "removedAt",
              "version",
            ]),
          })
      );
    }
    for (const kind of ["word", "sentence"] as const) {
      const hanzi = removed
        .filter((entry) => entry.kind === kind)
        .map((entry) => entry.hanzi);
      if (hanzi.length) {
        writes.push(
          transaction
            .update(focusEntries)
            .set({ removedAt: new Date(), version })
            .where(
              and(
                eq(focusEntries.learnerId, learnerId),
                eq(focusEntries.kind, kind),
                inArray(focusEntries.hanzi, hanzi)
              )
            )
        );
      }
    }
  }
  // Drizzle queries run when awaited, and a transaction takes one statement at a time: chain them.
  await writes.reduce<Promise<unknown>>(
    (previous, write) => previous.then(() => write),
    Promise.resolve()
  );
}

/**
 * Record changes, in order, each once: a change whose id is already stored is skipped. Applied
 * with the same `applyOperation` devices use, to just the rows they touch. A change that arrives
 * after a later one is placed by when it was made, not when it arrived.
 */
export async function writeOperations(
  learnerId: string,
  received: ProgressOperation[],
  now = new Date()
) {
  if (!received.length) {
    return;
  }
  const operations = received.map((operation) => notAfter(operation, now));
  await db.transaction(async (transaction) => {
    await transaction
      .insert(learners)
      .values({ id: learnerId })
      .onConflictDoNothing();
    const inserted = await transaction
      .insert(events)
      .values(
        operations.map((operation) => ({
          id: operation.id,
          learnerId,
          kind: operation.kind,
          data: operation.data,
          createdAt: new Date(operation.at),
        }))
      )
      .onConflictDoNothing()
      .returning({ id: events.id, seq: events.seq });
    if (!inserted.length) {
      return;
    }
    const fresh = new Set(inserted.map((row) => row.id));
    const applied = operations.filter((operation) => fresh.has(operation.id));
    const before = await readTargets(transaction, learnerId, applied);
    // A late card is rebuilt from its stored events, which now include this batch's.
    const late = lateCards(before, applied);
    const start = late.size
      ? await replayCards(transaction, learnerId, late, before)
      : before;
    const after = applied
      .filter((operation) => !late.has(targetCardKey(operation) ?? ""))
      .reduce((state, operation) => applyOperation(state, operation), start);
    const version = Math.max(...inserted.map((row) => row.seq));
    await writeChanges(
      transaction,
      learnerId,
      before,
      after,
      nameTimes(applied),
      version
    );
  });
}
