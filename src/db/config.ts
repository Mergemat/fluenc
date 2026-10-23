/** A local `file:` database needs no token; a Turso database does. */
export function getTursoCredentials() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is required. Run `bun run setup` to use a local database."
    );
  }
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
  if (!(authToken || url.startsWith("file:"))) {
    throw new Error(`TURSO_AUTH_TOKEN is required for ${url}`);
  }
  return { url, authToken };
}
