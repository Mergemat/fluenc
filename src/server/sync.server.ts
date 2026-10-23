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
      return [column, sql.raw(`excluded.${name}`)];
    })
  ) as Record<keyof T["$inferInsert"], SQL>;
}

/**
 * Rows changed after `cursor`, with the cursor that covers them; a null cursor reads everything.
 * One batch, so the rows and the cursor are read from the same moment.
 */
export async function readPatch(learnerId: string, cursor: number | null) {
  const since = cursor ?? -1;
  const [head, items, actors, sets, rooms, props, links, focus] =
    await db.batch([
      db
        .select({ seq: max(events.seq) })
        .from(events)
        .where(eq(events.learnerId, learnerId)),
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
  if (operation.kind !== "enroll" && operation.kind !== "review") {
    return null;
  }
  const target = studyIdentity(operation.data.itemType, operation.data.itemId);
  return cardKey(target.itemType, target.itemId);
}

/** Just the rows a set of changes reads: the cards they touch, and focus for the catalog. */
async function readTargets(
  reader: Reader,
  learnerId: string,
  operations: ProgressOperation[]
): Promise<LearnerState> {
  const keys = [
    ...new Set(
      operations.flatMap((operation) => targetCardKey(operation) ?? [])
    ),
  ];
  // One statement at a time: a transaction runs them in order anyway.
  const items = keys.length
    ? await reader
        .select()
        .from(learnerItems)
        .where(
          and(
            eq(learnerItems.learnerId, learnerId),
            inArray(
              sql`${learnerItems.itemType} || ':' || ${learnerItems.itemId}`,
              keys
            )
          )
        )
    : [];
  const focus = await reader
    .select()
    .from(focusEntries)
    .where(
      and(eq(focusEntries.learnerId, learnerId), isNull(focusEntries.removedAt))
    )
    .orderBy(asc(focusEntries.addedAt));
  return {
    ...emptyLearnerState,
    cards: Object.fromEntries(
      items.map((item) => [
        cardKey(item.itemType, item.itemId),
        cardSnapshot(item),
      ])
    ),
    focus: focus.map(focusEntry),
  };
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
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [palaceActors.learnerId, palaceActors.actorKey],
          set: excluded(palaceActors, ["actorName", "version"]),
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
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [palaceSets.learnerId, palaceSets.finalKey],
          set: excluded(palaceSets, ["setName", "version"]),
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
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [toneRooms.learnerId, toneRooms.tone],
          set: excluded(toneRooms, ["roomName", "version"]),
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
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [componentProps.learnerId, componentProps.component],
          set: excluded(componentProps, ["propName", "version"]),
        })
    );
  }
  const links = changedEntries(after.livingLinks, before.livingLinks);
  if (links.length) {
    const updatedAt = new Date();
    writes.push(
      transaction
        .insert(mnemonics)
        .values(
          links.map(([itemId, story]) => ({
            learnerId,
            itemType: "word" as const,
            itemId,
            story,
            updatedAt,
            version,
          }))
        )
        .onConflictDoUpdate({
          target: [mnemonics.learnerId, mnemonics.itemType, mnemonics.itemId],
          set: excluded(mnemonics, ["story", "updatedAt", "version"]),
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
  // Drizzle queries run when awaited; await them in order on the transaction.
  for (const write of writes) {
    // biome-ignore lint/performance/noAwaitInLoops: a transaction takes one statement at a time.
    await write;
  }
}

/**
 * Record changes, in order, each once: a change whose id is already stored is skipped. Applied
 * with the same `applyOperation` devices use, to just the rows they touch.
 */
export async function writeOperations(
  learnerId: string,
  operations: ProgressOperation[]
) {
  if (!operations.length) {
    return;
  }
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
    const after = applied.reduce(
      (state, operation) => applyOperation(state, operation),
      before
    );
    const version = Math.max(...inserted.map((row) => row.seq));
    await writeChanges(transaction, learnerId, before, after, version);
  });
}
