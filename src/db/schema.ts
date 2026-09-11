import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

export const learners = sqliteTable('learners', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export const learnerItems = sqliteTable(
  'learner_items',
  {
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    itemType: text('item_type', {
      enum: ['character', 'word', 'sentence', 'actor', 'set', 'tone'],
    }).notNull(),
    itemId: text('item_id').notNull(),
    due: integer('due', { mode: 'timestamp_ms' }).notNull(),
    stability: real('stability').notNull().default(0),
    difficulty: real('difficulty').notNull().default(0),
    elapsedDays: integer('elapsed_days').notNull().default(0),
    scheduledDays: integer('scheduled_days').notNull().default(0),
    learningSteps: integer('learning_steps').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: integer('state').notNull().default(0),
    lastReview: integer('last_review', { mode: 'timestamp_ms' }),
    introducedAt: integer('introduced_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.itemType, table.itemId] }),
    index('learner_items_due_idx').on(table.learnerId, table.due),
  ],
)

export const reviewLogs = sqliteTable(
  'review_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    itemType: text('item_type', {
      enum: ['character', 'word', 'sentence', 'actor', 'set', 'tone'],
    }).notNull(),
    itemId: text('item_id').notNull(),
    rating: integer('rating').notNull(),
    durationMs: integer('duration_ms').notNull().default(0),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index('review_logs_learner_date_idx').on(table.learnerId, table.reviewedAt)],
)

export const syncEvents = sqliteTable('sync_events', {
  id: text('id').primaryKey(),
  learnerId: text('learner_id')
    .notNull()
    .references(() => learners.id, { onDelete: 'cascade' }),
  appliedAt: integer('applied_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export const palaceActors = sqliteTable(
  'palace_actors',
  {
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    actorKey: text('actor_key').notNull(),
    actorName: text('actor_name').notNull(),
  },
  (table) => [primaryKey({ columns: [table.learnerId, table.actorKey] })],
)

export const palaceSets = sqliteTable(
  'palace_sets',
  {
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    finalKey: text('final_key').notNull(),
    setName: text('set_name').notNull(),
  },
  (table) => [primaryKey({ columns: [table.learnerId, table.finalKey] })],
)

export const toneRooms = sqliteTable(
  'tone_rooms',
  {
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    tone: integer('tone').notNull(),
    roomName: text('room_name').notNull(),
  },
  (table) => [primaryKey({ columns: [table.learnerId, table.tone] })],
)

export const componentProps = sqliteTable(
  'component_props',
  {
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    component: text('component').notNull(),
    propName: text('prop_name').notNull(),
  },
  (table) => [primaryKey({ columns: [table.learnerId, table.component] })],
)

export const mnemonics = sqliteTable(
  'mnemonics',
  {
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    itemType: text('item_type', { enum: ['word'] }).notNull(),
    itemId: text('item_id').notNull(),
    story: text('story').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [primaryKey({ columns: [table.learnerId, table.itemType, table.itemId] })],
)

export type LearnerItem = typeof learnerItems.$inferSelect
export type ItemType = LearnerItem['itemType']
