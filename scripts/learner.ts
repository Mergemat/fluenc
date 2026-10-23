// The account a script works on: `--email <address>`, or FLUENC_EMAIL from .env.
import "dotenv/config";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { user } from "../src/db/auth-schema";

/** The arguments without `--email <address>`, and the learner id that address signs in as. */
export async function resolveLearner(args: string[]) {
  const flag = args.indexOf("--email");
  const email = (
    flag === -1 ? process.env.FLUENC_EMAIL : args[flag + 1]
  )?.trim();
  const rest = flag === -1 ? args : args.toSpliced(flag, 2);
  if (!email) {
    console.error("Pass --email <address>, or set FLUENC_EMAIL in .env.");
    process.exit(1);
  }
  const [account] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.toLowerCase()));
  if (!account) {
    console.error(`No account for ${email}. Sign up in the app first.`);
    process.exit(1);
  }
  return { learnerId: account.id, email, args: rest };
}
