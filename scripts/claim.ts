// Move progress saved before accounts existed onto an account. Run once, after signing up:
//
//   bun run claim [--email you@example.com]
//
// The account keeps whatever it already has; only rows it lacks are moved. Devices pick the
// progress up on their next sync.
import { eq, sql } from "drizzle-orm";

import { db } from "../src/db";
import { events, learners } from "../src/db/schema";
import { resolveLearner } from "./learner";

const LEGACY_LEARNER = "default";
const versioned = [
  "learner_items",
  "palace_actors",
  "palace_sets",
  "tone_rooms",
  "component_props",
  "mnemonics",
  "focus_entries",
];

const { learnerId, email } = await resolveLearner(process.argv.slice(2));

const moved = await db.transaction(async (transaction) => {
  await transaction
    .insert(learners)
    .values({ id: learnerId })
    .onConflictDoNothing();
  // A change of its own, so devices already synced see the moved rows as new.
  const [claim] = await transaction
    .insert(events)
    .values({
      id: `claim-${crypto.randomUUID()}`,
      learnerId,
      kind: "claim",
      data: { from: LEGACY_LEARNER },
      createdAt: new Date(),
    })
    .returning({ seq: events.seq });
  if (!claim) {
    throw new Error("Could not record the claim");
  }
  const counts: Record<string, number> = {};
  for (const table of versioned) {
    // biome-ignore lint/performance/noAwaitInLoops: a transaction takes one statement at a time.
    const result = await transaction.run(
      sql`UPDATE OR IGNORE ${sql.identifier(table)} SET learner_id = ${learnerId}, version = ${claim.seq} WHERE learner_id = ${LEGACY_LEARNER}`
    );
    counts[table] = result.rowsAffected;
  }
  const history = await transaction.run(
    sql`UPDATE events SET learner_id = ${learnerId} WHERE learner_id = ${LEGACY_LEARNER}`
  );
  counts.events = history.rowsAffected;

  let left = 0;
  for (const table of [...versioned, "events"]) {
    // biome-ignore lint/performance/noAwaitInLoops: a transaction takes one statement at a time.
    const [row] = await transaction.all<{ count: number }>(
      sql`SELECT count(*) AS count FROM ${sql.identifier(table)} WHERE learner_id = ${LEGACY_LEARNER}`
    );
    left += row?.count ?? 0;
  }
  // Deleting the old learner deletes its rows; only do it once nothing is left behind.
  if (!left) {
    await transaction.delete(learners).where(eq(learners.id, LEGACY_LEARNER));
  }
  return { counts, left };
});

console.log(`Moved to ${email}:`);
for (const [table, count] of Object.entries(moved.counts)) {
  console.log(`  ${table.padEnd(16)} ${count}`);
}
if (moved.left) {
  console.log(
    `\n${moved.left} rows stayed behind: the account already had them. The old learner is kept.`
  );
}
