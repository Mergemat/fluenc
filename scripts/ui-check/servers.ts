// The two apps under comparison: the base commit in a git worktree and the working tree, each a
// dev server on its own copy of the seeded database, so nothing one does shows up in the other.
import { cp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { $ } from "bun";

export const ROOT = resolve(import.meta.dir, "../..");
export const WORK = join(ROOT, ".cache/ui-check");
const SEED_DB = join(WORK, "seed.db");
const SEED_META = join(WORK, "seed.json");

/** Deletes a SQLite file and its journals. */
const removeDatabase = (file: string) =>
  Promise.all(
    ["", "-shm", "-wal", "-journal"].map((suffix) =>
      rm(`${file}${suffix}`, { force: true })
    )
  );

/** Env for anything that touches the database: a local file, and no paid or remote services. */
export function localEnv(
  databaseFile: string,
  extra: Record<string, string> = {}
) {
  return {
    ...process.env,
    TURSO_DATABASE_URL: `file:${databaseFile}`,
    TURSO_AUTH_TOKEN: "",
    BETTER_AUTH_SECRET: "ui-check-secret-ui-check-secret-0000",
    ELEVENLABS_API_KEY: "",
    ELEVENLABS_VOICE_ID: "",
    BLOB_READ_WRITE_TOKEN: "",
    VAPID_PUBLIC_KEY: "",
    VAPID_PRIVATE_KEY: "",
    VAPID_SUBJECT: "",
    CRON_SECRET: "",
    ...extra,
  };
}

/** Builds the seeded database once; every run starts from a copy. Returns when it was seeded. */
export async function ensureSeed(reseed: boolean) {
  if (!reseed && (await Bun.file(SEED_META).exists())) {
    return (await Bun.file(SEED_META).json()).seededAt as number;
  }
  await mkdir(WORK, { recursive: true });
  await removeDatabase(SEED_DB);
  const env = localEnv(SEED_DB);
  const migrate = `import { migrateDatabase } from "./scripts/local-db"; await migrateDatabase();`;
  await $`bun -e ${migrate}`.cwd(ROOT).env(env).quiet();
  const seededAt = Date.now();
  await $`bun scripts/seed.ts`.cwd(ROOT).env(env).quiet();
  await $`bun scripts/ui-check/accounts.ts`.cwd(ROOT).env(env);
  await Bun.write(SEED_META, JSON.stringify({ seededAt }));
  return seededAt;
}

/** A checkout of `ref` outside the repo with its own install, as Vite serves only files under it. */
async function baseCheckout(ref: string) {
  const sha = (await $`git rev-parse ${ref}`.cwd(ROOT).text()).trim();
  const dir = join(tmpdir(), "fluenc-ui-check", sha.slice(0, 12));
  if (!(await Bun.file(join(dir, "package.json")).exists())) {
    await rm(dir, { recursive: true, force: true });
    await $`git worktree prune`.cwd(ROOT).quiet();
    await $`git worktree add --detach ${dir} ${sha}`.cwd(ROOT).quiet();
  }
  if (!(await Bun.file(join(dir, "node_modules/.bin/vite")).exists())) {
    await rm(join(dir, "node_modules"), { recursive: true, force: true });
    await $`bun install --frozen-lockfile`.cwd(dir).quiet();
  }
  return { dir, sha };
}

export interface Server {
  name: string;
  stop: () => void;
  url: string;
}

async function startServer(name: string, dir: string, port: number) {
  const database = join(tmpdir(), `fluenc-ui-check-${name}.db`);
  await removeDatabase(database);
  await cp(SEED_DB, database);
  const url = `http://localhost:${port}`;
  const child = Bun.spawn(
    [
      join(dir, "node_modules/.bin/vite"),
      "dev",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: dir,
      env: localEnv(database, { BETTER_AUTH_URL: url }),
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  const log: string[] = [];
  const drain = async (stream: ReadableStream<Uint8Array>) => {
    for await (const chunk of stream) {
      log.push(new TextDecoder().decode(chunk));
    }
  };
  drain(child.stdout);
  drain(child.stderr);
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`${name} server exited:\n${log.join("")}`);
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: polls until the server answers.
      const response = await fetch(`${url}/manifest.webmanifest`);
      if (response.ok) {
        return { name, url, stop: () => child.kill() } satisfies Server;
      }
    } catch {
      // Not listening yet.
    }
    await Bun.sleep(200);
  }
  child.kill();
  throw new Error(`${name} server did not start:\n${log.join("")}`);
}

export async function startServers(baseRef: string, port: number) {
  const base = await baseCheckout(baseRef);
  const servers = await Promise.all([
    startServer("base", base.dir, port),
    startServer("head", ROOT, port + 1),
  ]);
  return { base: servers[0], head: servers[1], baseSha: base.sha };
}
