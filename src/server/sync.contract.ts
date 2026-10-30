import { z } from "zod";

import { studyItemTypes } from "../data/types";
import type { LearnerPatch } from "../lib/learner-state";
import { MAX_SYNC_OPERATIONS } from "./sync.limits";

export const reviewInput = z.object({
  itemType: z.enum(studyItemTypes),
  itemId: z.string().min(1),
  rating: z.number().int().min(1).max(4),
  durationMs: z.number().int().min(0).max(3_600_000).default(0),
  reviewedAt: z.iso.datetime(),
});

const cardSnapshot = z.object({
  due: z.iso.datetime(),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number().int(),
  scheduledDays: z.number().int(),
  learningSteps: z.number().int(),
  reps: z.number().int(),
  lapses: z.number().int(),
  state: z.number().int(),
  lastReview: z.iso.datetime().nullable(),
  introducedAt: z.iso.datetime().optional(),
});

/**
 * Takes a review back. `card` is the card as it was before the review, which the device restores;
 * the server rebuilds the card from its events instead, without the review.
 */
export const undoInput = z.object({
  reviewId: z.string().min(8).max(64),
  itemType: z.enum(studyItemTypes),
  itemId: z.string().min(1),
  card: cardSnapshot,
});

export const enrollInput = z.object({
  itemType: z.enum(studyItemTypes),
  itemId: z.string().min(1),
  enrolledAt: z.iso.datetime(),
});

export const movieInput = z.object({
  characterId: z.string().min(1),
  actorKey: z.string().min(1),
  actorName: z.string().trim(),
  finalKey: z.string().min(1),
  setName: z.string().trim(),
  tone: z.number().int().min(1).max(5),
  roomName: z.string().trim(),
  props: z.array(
    z.object({
      component: z.string().min(1),
      propName: z.string().trim().min(1),
    })
  ),
});

export const livingLinkInput = z.object({
  wordId: z.string().min(1),
  story: z.string().trim().min(4),
});

const focusEntryInput = z.object({
  kind: z.enum(["word", "sentence"]),
  hanzi: z.string().trim().min(1),
  pinyin: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
  label: z.string().trim().min(1),
  addedAt: z.iso.datetime(),
});

/** Focus is written by `bun run focus`, never by a device. */
export const focusInput = z.union([
  z.object({ add: z.array(focusEntryInput) }),
  z.object({ remove: z.array(z.string().min(1)) }),
]);

/** Every change has an id chosen where it was made, so sending it twice applies it once. */
const change = { id: z.string().min(8).max(64), at: z.iso.datetime() };

/** A change a device can send. */
export const deviceOperation = z.discriminatedUnion("kind", [
  z.object({ ...change, kind: z.literal("enroll"), data: enrollInput }),
  z.object({ ...change, kind: z.literal("review"), data: reviewInput }),
  z.object({ ...change, kind: z.literal("undo"), data: undoInput }),
  z.object({ ...change, kind: z.literal("movie"), data: movieInput }),
  z.object({ ...change, kind: z.literal("livingLink"), data: livingLinkInput }),
]);

export const syncRequest = z.object({
  /** The highest change the device has; null asks for everything. */
  cursor: z.number().int().nonnegative().nullable(),
  /** The account the device's progress belongs to, if any. */
  learner: z.string().min(1).nullable(),
  /** Changes not yet sent, oldest first. Checked one by one so one bad change cannot block the rest. */
  operations: z.array(z.unknown()).max(MAX_SYNC_OPERATIONS),
});

export type ReviewInput = z.infer<typeof reviewInput>;
export type UndoInput = z.infer<typeof undoInput>;
export type EnrollInput = z.infer<typeof enrollInput>;
export type MovieInput = z.infer<typeof movieInput>;
export type LivingLinkInput = z.infer<typeof livingLinkInput>;
export type FocusInput = z.infer<typeof focusInput>;
export type DeviceOperation = z.infer<typeof deviceOperation>;
export type SyncRequest = z.infer<typeof syncRequest>;

export interface SyncResponse {
  /** Ids of every change received, applied or not. */
  acknowledged: string[];
  cursor: number;
  learner: Learner;
  patch: LearnerPatch;
  /** The patch is everything: replace the device's copy instead of adding to it. */
  reset: boolean;
}

export interface Learner {
  email: string;
  id: string;
}
