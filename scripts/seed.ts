// Add a demo account with two weeks of progress to the local database:
//
//   bun run db:seed
//
// Sign in as demo@example.com / demo-password. It has learned about 170 characters and words,
// has reviews due and sentences to read. Only runs against a local file: database.
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { user } from "../src/db/auth-schema";
import {
  applyOperation,
  emptyLearnerState,
  type LearnerState,
  type ProgressChange,
  type ProgressOperation,
} from "../src/lib/learner-state";
import { deriveDashboard } from "../src/lib/learner-views";
import { writeOperations } from "../src/server/sync.server";
import { requireLocalDatabase } from "./local-db";

const EMAIL = "demo@example.com";
const PASSWORD = "demo-password";
const DAYS = 13;
const LESSONS_PER_DAY = 13;
const DAY_MS = 86_400_000;

const actors = [
  "Yoda",
  "Robin Hood",
  "Gandalf",
  "Darth Vader",
  "Tintin",
  "Lara Croft",
  "Bilbo",
  "Zorro",
  "Sherlock",
  "Mary Poppins",
  "Hermione",
  "Popeye",
  "Mulan",
  "Willy Wonka",
  "Indiana Jones",
  "Columbo",
  "Dracula",
  "Peter Pan",
  "Marge Simpson",
  "Pippi",
  "Captain Hook",
  "Totoro",
];
const sets = [
  "grandma's house",
  "the old school",
  "the beach cabin",
  "the train station",
  "the corner café",
  "the gym",
  "the ferry",
  "the library",
  "the night market",
  "the attic",
  "the bakery",
  "the hospital",
  "the ski lodge",
  "the cinema",
  "the garden",
];
const props = [
  "a plank",
  "a scythe",
  "a slide",
  "a tent",
  "a lantern",
  "a fishing rod",
  "a kite",
  "a broom",
  "a teapot",
  "a ladder",
  "a drum",
  "an umbrella",
  "a mirror",
  "a rope",
  "a chopstick",
  "a hammock",
  "a bucket",
  "a compass",
  "a feather",
  "a key",
  "a bell",
  "a candle",
  "a saddle",
  "an anchor",
  "a tripod",
  "a shovel",
  "a crown",
  "a whistle",
  "a coin",
  "a skateboard",
  "a paper fan",
  "a jar",
  "a scarf",
  "a magnet",
];

requireLocalDatabase("seed demo data");
// Sign-up runs outside a request here, so it needs an origin of its own.
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
const { auth } = await import("../src/server/auth.server");

const [existing] = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.email, EMAIL));
if (existing) {
  console.log(
    `${EMAIL} already exists. Run \`bun run db:reset\` to start over.`
  );
  process.exit(0);
}
await auth.api.signUpEmail({
  body: { email: EMAIL, password: PASSWORD, name: "Demo" },
});
const [account] = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.email, EMAIL));
if (!account) {
  throw new Error(`Could not create ${EMAIL}`);
}

let state: LearnerState = emptyLearnerState;
const operations: ProgressOperation[] = [];
const record = (at: Date, change: ProgressChange) => {
  const operation = {
    id: `seed-${String(operations.length).padStart(6, "0")}`,
    at: at.toISOString(),
    ...change,
  } as ProgressOperation;
  operations.push(operation);
  state = applyOperation(state, operation);
};
// The next name in a list, cycling once every name is taken.
const nextName = (names: string[], taken: Record<string, string>) =>
  names[Object.keys(taken).length % names.length];
// Mostly Good, with some Hard, Easy and Again, the same on every run.
const rating = (index: number) => {
  const roll = (index * 7919) % 20;
  if (roll === 0) {
    return 1;
  }
  if (roll < 3) {
    return 2;
  }
  return roll > 17 ? 4 : 3;
};

const now = Date.now();
for (let daysAgo = DAYS; daysAgo > 0; daysAgo -= 1) {
  const day = now - daysAgo * DAY_MS;
  let minute = 0;
  const tick = (minutes = 1) => {
    minute += minutes;
    return new Date(day + minute * 60_000);
  };

  for (const item of deriveDashboard(state, new Date(day)).reviewQueue) {
    const at = tick();
    record(at, {
      kind: "review",
      data: {
        itemType: item.type,
        itemId: item.id,
        rating: rating(operations.length),
        durationMs: 4000,
        reviewedAt: at.toISOString(),
      },
    });
  }

  for (let lesson = 0; lesson < LESSONS_PER_DAY; lesson += 1) {
    const [next] = deriveDashboard(state, new Date(day)).buildQueue;
    if (!next) {
      break;
    }
    if (next.type === "character") {
      const { movie } = next;
      record(tick(), {
        kind: "movie",
        data: {
          characterId: next.id,
          actorKey: movie.actorKey,
          actorName:
            state.actors[movie.actorKey] ?? nextName(actors, state.actors),
          finalKey: movie.finalKey,
          setName: state.sets[movie.finalKey] ?? nextName(sets, state.sets),
          tone: movie.tone,
          roomName: movie.roomName,
          props: movie.components.map(({ hanzi }) => ({
            component: hanzi,
            propName: state.props[hanzi] ?? nextName(props, state.props),
          })),
        },
      });
    }
    const enrolledAt = tick();
    record(enrolledAt, {
      kind: "enroll",
      data: {
        itemType: next.type,
        itemId: next.id,
        enrolledAt: enrolledAt.toISOString(),
      },
    });
    // The lesson's two learning steps, ten minutes apart.
    for (let step = 0; step < 2; step += 1) {
      const reviewedAt = tick(10);
      record(reviewedAt, {
        kind: "review",
        data: {
          itemType: next.type,
          itemId: next.id,
          rating: 3,
          durationMs: 5000,
          reviewedAt: reviewedAt.toISOString(),
        },
      });
    }
  }

  // Read one fully known sentence a day, leaving the last few days' for the demo.
  const sentence = deriveDashboard(state, new Date(day)).getQueue.find(
    (item) => item.coverage === 1
  );
  if (sentence && daysAgo > 4) {
    const enrolledAt = tick();
    record(enrolledAt, {
      kind: "enroll",
      data: {
        itemType: "sentence",
        itemId: sentence.id,
        enrolledAt: enrolledAt.toISOString(),
      },
    });
  }
}

await writeOperations(account.id, operations);
const today = deriveDashboard(state, new Date());
console.log(
  `Seeded ${EMAIL} / ${PASSWORD}: ${Object.keys(state.cards).length} items learned, ${today.reviewQueue.length} reviews due, ${today.getQueue.length} sentences to read.`
);
