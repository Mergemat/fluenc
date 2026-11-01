// Coding agents a learner allowed to manage their focus, through the OAuth flow on /connect.
import { and, desc, eq } from "drizzle-orm";

import { db } from "../db";
import {
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
} from "../db/auth-schema";

/** Whether the learner still allows this agent. Checked on every call, so Disconnect is immediate. */
export async function isAllowed(learnerId: string, clientId: string) {
  const [consent] = await db
    .select({ id: oauthConsent.id })
    .from(oauthConsent)
    .where(
      and(
        eq(oauthConsent.userId, learnerId),
        eq(oauthConsent.clientId, clientId)
      )
    )
    .limit(1);
  return Boolean(consent);
}

export function listAgents(learnerId: string) {
  return db
    .select({
      clientId: oauthConsent.clientId,
      name: oauthClient.name,
      connectedAt: oauthConsent.createdAt,
    })
    .from(oauthConsent)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
    .where(eq(oauthConsent.userId, learnerId))
    .orderBy(desc(oauthConsent.createdAt));
}

/** Forget the consent and every token the agent holds for this learner. */
export async function disconnectAgent(learnerId: string, clientId: string) {
  const mine = (
    table:
      | typeof oauthConsent
      | typeof oauthRefreshToken
      | typeof oauthAccessToken
  ) => and(eq(table.userId, learnerId), eq(table.clientId, clientId));
  await db.batch([
    db.delete(oauthConsent).where(mine(oauthConsent)),
    db.delete(oauthAccessToken).where(mine(oauthAccessToken)),
    db.delete(oauthRefreshToken).where(mine(oauthRefreshToken)),
  ]);
}
