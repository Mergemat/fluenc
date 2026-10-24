import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { studyItemTypes } from "../data/types";
import { account, session, user, verification } from "./auth-schema";

/** One per account; its id is the user's id. Every row of progress below belongs to one. */
export const learners = sqliteTable("learners", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * The `seq` of the last change written to a row. A device sends the highest `seq` it has seen and
 * gets back only the rows changed since. Each table indexes it by learner, so a sync reads just
 * those rows: Turso bills every row a query scans, not the rows it returns.
 */
const version = () => integer("version").notNull().default(0);

/**
 * When the row's value was chosen, by the device's clock. An older change that arrives late does
 * not replace it.
 */
const changedAt = () =>
  integer("changed_at", { mode: "timestamp_ms" }).notNull().default(sql`0`);

export const learnerItems = sqliteTable(
  "learner_items",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    itemType: text("item_type", {
      enum: studyItemTypes,
    }).notNull(),
    itemId: text("item_id").notNull(),
    due: integer("due", { mode: "timestamp_ms" }).notNull(),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: integer("state").notNull().default(0),
    lastReview: integer("last_review", { mode: "timestamp_ms" }),
    introducedAt: integer("introduced_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    version: version(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.itemType, table.itemId] }),
    index("learner_items_due_idx").on(table.learnerId, table.due),
    index("learner_items_version_idx").on(table.learnerId, table.version),
  ]
);

/**
 * Every change a device or script made, in the order the server received it. Its `id` is chosen by
 * the device, so a change sent twice is applied once. Reviews here are the learner's review log.
 */
export const events = sqliteTable(
  "events",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    id: text("id").notNull().unique(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    data: text("data", { mode: "json" }).notNull(),
    /** When the change was made, by the device's clock. */
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("events_learner_seq_idx").on(table.learnerId, table.seq),
    // Rebuilding a card that got a late change finds its events by item.
    index("events_learner_item_idx").on(
      table.learnerId,
      sql`json_extract(${table.data}, '$.itemId')`
    ),
  ]
);

export const palaceActors = sqliteTable(
  "palace_actors",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    actorKey: text("actor_key").notNull(),
    actorName: text("actor_name").notNull(),
    changedAt: changedAt(),
    version: version(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.actorKey] }),
    index("palace_actors_version_idx").on(table.learnerId, table.version),
  ]
);

export const palaceSets = sqliteTable(
  "palace_sets",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    finalKey: text("final_key").notNull(),
    setName: text("set_name").notNull(),
    changedAt: changedAt(),
    version: version(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.finalKey] }),
    index("palace_sets_version_idx").on(table.learnerId, table.version),
  ]
);

export const toneRooms = sqliteTable(
  "tone_rooms",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    tone: integer("tone").notNull(),
    roomName: text("room_name").notNull(),
    changedAt: changedAt(),
    version: version(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.tone] }),
    index("tone_rooms_version_idx").on(table.learnerId, table.version),
  ]
);

export const componentProps = sqliteTable(
  "component_props",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    component: text("component").notNull(),
    propName: text("prop_name").notNull(),
    changedAt: changedAt(),
    version: version(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.component] }),
    index("component_props_version_idx").on(table.learnerId, table.version),
  ]
);

export const mnemonics = sqliteTable(
  "mnemonics",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    itemType: text("item_type", { enum: ["word"] }).notNull(),
    itemId: text("item_id").notNull(),
    story: text("story").notNull(),
    /** When the story was written, by the device's clock; see `changedAt`. */
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    version: version(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.itemType, table.itemId] }),
    index("mnemonics_version_idx").on(table.learnerId, table.version),
  ]
);

/** Words and sentences the learner wants taught next; see `FocusEntry`. */
export const focusEntries = sqliteTable(
  "focus_entries",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["word", "sentence"] }).notNull(),
    hanzi: text("hanzi").notNull(),
    pinyin: text("pinyin").notNull(),
    meaning: text("meaning").notNull(),
    label: text("label").notNull(),
    addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
    /** Set when the entry is removed, so devices that have it learn it is gone. */
    removedAt: integer("removed_at", { mode: "timestamp_ms" }),
    version: version(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.kind, table.hanzi] }),
    index("focus_entries_version_idx").on(table.learnerId, table.version),
  ]
);

export type LearnerItem = typeof learnerItems.$inferSelect;
export type ItemType = LearnerItem["itemType"];

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  lastReminderDay: integer("last_reminder_day"),
});

/** Every table, for drizzle's typed client. */
export const schema = {
  user,
  session,
  account,
  verification,
  learners,
  learnerItems,
  events,
  palaceActors,
  palaceSets,
  toneRooms,
  componentProps,
  mnemonics,
  focusEntries,
  pushSubscriptions,
};
