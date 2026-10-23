// Helpers for scripts that create, reset or fill a database.
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { getTursoCredentials } from "../src/db/config";

/** The SQLite file behind a `file:` database URL, or null for a remote database. */
export function localDatabaseFile() {
  const { url } = getTursoCredentials();
  if (!url.startsWith("file:")) {
    return null;
  }
  return url.startsWith("file://")
    ? fileURLToPath(url)
    : url.slice("file:".length);
}

/** Exits unless the configured database is a local file, so nothing here touches production. */
export function requireLocalDatabase(action: string) {
  const file = localDatabaseFile();
  if (!file) {
    console.error(
      `Refusing to ${action}: TURSO_DATABASE_URL is not a local file: database.`
    );
    process.exit(1);
  }
  return file;
}

export async function deleteLocalDatabase(file: string) {
  await Promise.all(
    ["", "-shm", "-wal", "-journal"].map((suffix) =>
      rm(`${file}${suffix}`, { force: true })
    )
  );
}

/** Applies every migration in `drizzle/`. */
export async function migrateDatabase() {
  const { db } = await import("../src/db");
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  await migrate(db, { migrationsFolder: "drizzle" });
}
