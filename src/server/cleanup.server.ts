// Daily cleanup of rows that anyone can create and nothing else removes.
import { and, eq, like, lt, notExists } from "drizzle-orm";

import { db } from "../db";
import {
  oauthClient,
  oauthConsent,
  rateLimit,
  verification,
} from "../db/auth-schema";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Agents register themselves before anyone approves them, so a client no learner allowed within a
 * day is spam or an abandoned attempt; agents register again when they reconnect.
 */
export async function cleanUp(now = new Date()) {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const [clients, previews, limits] = await db.batch([
    db
      .delete(oauthClient)
      .where(
        and(
          lt(oauthClient.createdAt, dayAgo),
          notExists(
            db
              .select({ id: oauthConsent.id })
              .from(oauthConsent)
              .where(eq(oauthConsent.clientId, oauthClient.clientId))
          )
        )
      )
      .returning({ id: oauthClient.id }),
    db
      .delete(verification)
      .where(
        and(
          like(verification.identifier, "focus-preview:%"),
          lt(verification.expiresAt, now)
        )
      )
      .returning({ id: verification.id }),
    db
      .delete(rateLimit)
      .where(lt(rateLimit.lastRequest, dayAgo.getTime()))
      .returning({ id: rateLimit.id }),
  ]);
  return {
    agentClients: clients.length,
    previews: previews.length,
    rateLimits: limits.length,
  };
}

/** The cron request carries `CRON_SECRET`, like the review reminder. */
export async function handleCleanup(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await cleanUp());
}
