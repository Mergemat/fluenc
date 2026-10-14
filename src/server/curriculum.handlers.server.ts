import { and, asc, eq, inArray } from "drizzle-orm";
import { type Card, createEmptyCard, type Grade } from "ts-fsrs";

import { studyItemTypes } from "../data/types";
import { db } from "../db";
import {
  componentProps,
  focusEntries,
  type ItemType,
  type LearnerItem,
  learnerItems,
  learners,
  mnemonics,
  palaceActors,
  palaceSets,
  reviewLogs,
  syncEvents,
  toneRooms,
} from "../db/schema";
import { catalogFor } from "../lib/catalog";
import { studyIdentity } from "../lib/character-words";
import {
  type CardSnapshot,
  cardKey,
  type LearnerState,
  reviewTime,
  toCard,
} from "../lib/learner-state";
import { scheduleReview } from "../lib/review-schedule";
import type {
  EnrollInput,
  LivingLinkInput,
  MovieInput,
  ReviewInput,
} from "./curriculum.contract";

const LEARNER_ID = "default";

let learnerReady: Promise<unknown> | undefined;

function ensureLearner() {
  learnerReady ??= db
    .insert(learners)
    .values({ id: LEARNER_ID })
    .onConflictDoNothing()
    .then(() => undefined)
    .catch((error: unknown) => {
      learnerReady = undefined;
      throw error;
    });
  return learnerReady;
}

function learnerItemValues(
  itemType: ItemType,
  itemId: string,
  card: Card,
  introducedAt?: Date
) {
  return {
    learnerId: LEARNER_ID,
    itemType,
    itemId,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review,
    ...(introducedAt ? { introducedAt } : {}),
  };
}

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

function focusQuery() {
  return db
    .select()
    .from(focusEntries)
    .where(eq(focusEntries.learnerId, LEARNER_ID))
    .orderBy(asc(focusEntries.addedAt));
}

function focusState(
  entries: Awaited<ReturnType<typeof focusQuery>>
): LearnerState["focus"] {
  return entries.map((entry) => ({
    kind: entry.kind,
    hanzi: entry.hanzi,
    pinyin: entry.pinyin,
    meaning: entry.meaning,
    label: entry.label,
    addedAt: entry.addedAt.toISOString(),
  }));
}

/** The learner's stored progress. Devices derive their dashboard, library and palace from it. */
export async function getLearnerStateHandler(): Promise<LearnerState> {
  const [items, actors, sets, rooms, props, stories, focus] = await db.batch([
    db
      .select()
      .from(learnerItems)
      .where(
        and(
          eq(learnerItems.learnerId, LEARNER_ID),
          inArray(learnerItems.itemType, studyItemTypes)
        )
      ),
    db
      .select()
      .from(palaceActors)
      .where(eq(palaceActors.learnerId, LEARNER_ID)),
    db.select().from(palaceSets).where(eq(palaceSets.learnerId, LEARNER_ID)),
    db.select().from(toneRooms).where(eq(toneRooms.learnerId, LEARNER_ID)),
    db
      .select()
      .from(componentProps)
      .where(eq(componentProps.learnerId, LEARNER_ID)),
    db
      .select()
      .from(mnemonics)
      .where(
        and(eq(mnemonics.learnerId, LEARNER_ID), eq(mnemonics.itemType, "word"))
      ),
    focusQuery(),
  ]);
  return {
    cards: Object.fromEntries(
      items.map((item) => [
        cardKey(item.itemType, item.itemId),
        cardSnapshot(item),
      ])
    ),
    focus: focusState(focus),
    actors: Object.fromEntries(
      actors.map((item) => [item.actorKey, item.actorName])
    ),
    sets: Object.fromEntries(sets.map((item) => [item.finalKey, item.setName])),
    rooms: Object.fromEntries(rooms.map((item) => [item.tone, item.roomName])),
    props: Object.fromEntries(
      props.map((item) => [item.component, item.propName])
    ),
    livingLinks: Object.fromEntries(
      stories.map((item) => [item.itemId, item.story])
    ),
  };
}

export async function enrollItemHandler(input: EnrollInput) {
  const data = { ...input, ...studyIdentity(input.itemType, input.itemId) };
  await ensureLearner();
  // The learner's own words and sentences are only in the catalog built with their focus.
  const catalog = catalogFor({ focus: focusState(await focusQuery()) });

  if (
    data.itemType === "character" &&
    !catalog.charactersById.has(data.itemId)
  ) {
    throw new Error("Character not found");
  }
  if (data.itemType === "word" && !catalog.wordsById.has(data.itemId)) {
    throw new Error("Word not found");
  }
  if (data.itemType === "sentence" && !catalog.sentencesById.has(data.itemId)) {
    throw new Error("Sentence not found");
  }

  const introducedAt = new Date(data.enrolledAt);
  const card = createEmptyCard(introducedAt);
  await db
    .insert(learnerItems)
    .values(learnerItemValues(data.itemType, data.itemId, card, introducedAt))
    .onConflictDoNothing();

  return { due: card.due.toISOString(), state: card.state };
}

export async function reviewItemHandler(input: ReviewInput) {
  const data = { ...input, ...studyIdentity(input.itemType, input.itemId) };
  await ensureLearner();
  return db.transaction(async (transaction) => {
    const claimed = await transaction
      .insert(syncEvents)
      .values({ id: data.eventId, learnerId: LEARNER_ID })
      .onConflictDoNothing()
      .returning({ id: syncEvents.id });
    if (!claimed.length) {
      return { duplicate: true as const };
    }

    const existing = await transaction
      .select()
      .from(learnerItems)
      .where(
        and(
          eq(learnerItems.learnerId, LEARNER_ID),
          eq(learnerItems.itemType, data.itemType),
          eq(learnerItems.itemId, data.itemId)
        )
      )
      .limit(1);

    if (!existing[0]) {
      throw new Error("Card is not in review yet");
    }

    const reviewedAt = reviewTime(
      existing[0].lastReview,
      new Date(data.reviewedAt)
    );
    const currentCard = toCard(cardSnapshot(existing[0]));
    const nextCard = scheduleReview(
      currentCard,
      reviewedAt,
      data.rating as Grade
    );
    const values = learnerItemValues(data.itemType, data.itemId, nextCard);

    await transaction
      .insert(learnerItems)
      .values(values)
      .onConflictDoUpdate({
        target: [
          learnerItems.learnerId,
          learnerItems.itemType,
          learnerItems.itemId,
        ],
        set: values,
      });
    await transaction.insert(reviewLogs).values({
      learnerId: LEARNER_ID,
      itemType: data.itemType,
      itemId: data.itemId,
      rating: data.rating,
      durationMs: data.durationMs,
      reviewedAt,
    });

    return {
      due: nextCard.due.toISOString(),
      state: nextCard.state,
      duplicate: false as const,
    };
  });
}

export async function saveMovieHandler(data: MovieInput) {
  await ensureLearner();
  await Promise.all([
    ...(data.actorName
      ? [
          db
            .insert(palaceActors)
            .values({
              learnerId: LEARNER_ID,
              actorKey: data.actorKey,
              actorName: data.actorName,
            })
            .onConflictDoUpdate({
              target: [palaceActors.learnerId, palaceActors.actorKey],
              set: { actorName: data.actorName },
            }),
        ]
      : []),
    ...(data.setName
      ? [
          db
            .insert(palaceSets)
            .values({
              learnerId: LEARNER_ID,
              finalKey: data.finalKey,
              setName: data.setName,
            })
            .onConflictDoUpdate({
              target: [palaceSets.learnerId, palaceSets.finalKey],
              set: { setName: data.setName },
            }),
        ]
      : []),
    ...(data.roomName
      ? [
          db
            .insert(toneRooms)
            .values({
              learnerId: LEARNER_ID,
              tone: data.tone,
              roomName: data.roomName,
            })
            .onConflictDoUpdate({
              target: [toneRooms.learnerId, toneRooms.tone],
              set: { roomName: data.roomName },
            }),
        ]
      : []),
    ...data.props.map((prop) =>
      db
        .insert(componentProps)
        .values({
          learnerId: LEARNER_ID,
          component: prop.component,
          propName: prop.propName,
        })
        .onConflictDoUpdate({
          target: [componentProps.learnerId, componentProps.component],
          set: { propName: prop.propName },
        })
    ),
  ]);
  return { saved: true };
}

export async function saveLivingLinkHandler(data: LivingLinkInput) {
  await ensureLearner();
  await db
    .insert(mnemonics)
    .values({
      learnerId: LEARNER_ID,
      itemType: "word",
      itemId: data.wordId,
      story: data.story,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [mnemonics.learnerId, mnemonics.itemType, mnemonics.itemId],
      set: { story: data.story, updatedAt: new Date() },
    });
  return { saved: true };
}

/** Add words and sentences to the learner's focus. One already there keeps its place and label. */
export async function addFocusHandler(entries: LearnerState["focus"]) {
  await ensureLearner();
  if (!entries.length) {
    return;
  }
  await db
    .insert(focusEntries)
    .values(
      entries.map((entry) => ({
        ...entry,
        learnerId: LEARNER_ID,
        addedAt: new Date(entry.addedAt),
      }))
    )
    .onConflictDoNothing();
}

/** Remove focus entries by spelling. Progress on them is kept. */
export async function removeFocusHandler(hanzi: string[]) {
  if (!hanzi.length) {
    return 0;
  }
  const removed = await db
    .delete(focusEntries)
    .where(
      and(
        eq(focusEntries.learnerId, LEARNER_ID),
        inArray(focusEntries.hanzi, hanzi)
      )
    )
    .returning({ hanzi: focusEntries.hanzi });
  return removed.length;
}
