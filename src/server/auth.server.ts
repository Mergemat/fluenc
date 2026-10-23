import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { db } from "../db";
import { schema } from "../db/schema";

const DAY_SECONDS = 24 * 60 * 60;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true, autoSignIn: true },
  session: {
    // A home screen app is opened, not logged into: stay signed in while it is used.
    expiresIn: 180 * DAY_SECONDS,
    updateAge: DAY_SECONDS,
    // Sync checks the session on every call; a signed cookie answers most without the database.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [tanstackStartCookies()],
});

export type Session = typeof auth.$Infer.Session;
