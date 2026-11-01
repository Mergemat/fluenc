import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth/minimal";
import { jwt } from "better-auth/plugins/jwt";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { db } from "../db";
import { schema } from "../db/schema";

const DAY_SECONDS = 24 * 60 * 60;

// Agents' tokens name the MCP endpoint as their audience, so it needs a fixed address even
// locally, where the rest of auth takes its origin from each request.
export const appOrigin = process.env.BETTER_AUTH_URL || "http://localhost:3000";
export const mcpResource = new URL("/mcp", appOrigin).href;
export const authIssuer = new URL("/api/auth", appOrigin).href;
/** Where agents send learners to sign in and allow access. */
export const AGENT_CONSENT_PAGE = "/connect";

export const auth = betterAuth({
  // Unset locally: the origin then comes from each request, so any dev port works.
  baseURL: process.env.BETTER_AUTH_URL || undefined,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true, autoSignIn: true },
  rateLimit: {
    // Serverless instances share no memory; counted in the database, a limit holds on all of them.
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60 * 60, max: 10 },
      // Anyone may register an agent, so registration is the endpoint a flood would use.
      "/oauth2/register": { window: 60 * 60, max: 20 },
      "/oauth2/token": { window: 60, max: 30 },
    },
  },
  session: {
    // A home screen app is opened, not logged into: stay signed in while it is used.
    expiresIn: 180 * DAY_SECONDS,
    updateAge: DAY_SECONDS,
    // Sync checks the session on every call; a signed cookie answers most without the database.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [
    jwt({ jwt: { issuer: authIssuer } }),
    mcp({
      resource: mcpResource,
      loginPage: AGENT_CONSENT_PAGE,
      consentPage: AGENT_CONSENT_PAGE,
      scopes: ["openid", "offline_access"],
      // Coding agents register themselves on first connect; no one hands out client ids.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      // Agents register a localhost callback without saying they are native apps.
      clientRegistrationDefaultApplicationType: "infer",
      // So /connect can name the agent before the learner signs in.
      allowPublicClientPrelogin: true,
      // Not every agent asks for a refresh token. Disconnecting ends access at once anyway: the
      // MCP route checks the learner's consent on every call.
      accessTokenExpiresIn: 30 * DAY_SECONDS,
      refreshTokenExpiresIn: 180 * DAY_SECONDS,
    }),
    // Last, so it forwards the cookies every other plugin sets.
    tanstackStartCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
