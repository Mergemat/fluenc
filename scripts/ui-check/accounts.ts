// Learners at the lesson screens the demo account never reaches: each has taken the first N lessons
// of the course, so its next lesson is a known character. Run by ui-check after the demo seed.
import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { user } from "../../src/db/auth-schema";
import {
  applyOperation,
  emptyLearnerState,
  type LearnerState,
  type ProgressChange,
  type ProgressOperation,
} from "../../src/lib/learner-state";
import { deriveDashboard } from "../../src/lib/learner-views";
import { writeOperations } from "../../src/server/sync.server";
import { learners } from "./learners";

// Sign-up runs outside a request here, so it needs an origin of its own.
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
const { auth } = await import("../../src/server/auth.server");

const DAY_MS = 86_400_000;

for (const learner of learners) {
  // biome-ignore lint/performance/noAwaitInLoops: one SQLite file; accounts are written in turn.
  await auth.api.signUpEmail({
    body: {
      email: learner.email,
      password: learner.password,
      name: learner.email,
    },
  });
  const [account] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, learner.email));
  if (!account) {
    throw new Error(`Could not create ${learner.email}`);
  }
  let state: LearnerState = emptyLearnerState;
  const operations: ProgressOperation[] = [];
  const at = new Date(Date.now() - DAY_MS);
  const record = (change: ProgressChange) => {
    const operation = {
      id: `ui-${String(operations.length).padStart(6, "0")}`,
      at: at.toISOString(),
      ...change,
    } as ProgressOperation;
    operations.push(operation);
    state = applyOperation(state, operation);
  };
  for (let lesson = 0; lesson < learner.lessons; lesson += 1) {
    const [next] = deriveDashboard(state, at).buildQueue;
    if (!next) {
      break;
    }
    if (next.type === "character" && learner.named) {
      const { movie } = next;
      record({
        kind: "movie",
        data: {
          characterId: next.id,
          actorKey: movie.actorKey,
          actorName: state.actors[movie.actorKey] ?? `actor ${lesson}`,
          finalKey: movie.finalKey,
          setName: state.sets[movie.finalKey] ?? `set ${lesson}`,
          tone: movie.tone,
          roomName: movie.roomName,
          props: movie.components.map(({ hanzi }) => ({
            component: hanzi,
            propName: state.props[hanzi] ?? `prop ${lesson}`,
          })),
        },
      });
    }
    record({
      kind: "enroll",
      data: {
        itemType: next.type,
        itemId: next.id,
        enrolledAt: at.toISOString(),
      },
    });
  }
  await writeOperations(account.id, operations);
  const [next] = deriveDashboard(state, new Date()).buildQueue;
  console.log(`${learner.email}: next lesson ${next?.type} ${next?.hanzi}`);
}
