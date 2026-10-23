// Get a clone running: write .env, create the database and list what is switched on.
//
//   bun run setup             fill in .env and apply migrations; safe to run again
//   bun run db:reset          delete the local database and start it over
//
// Existing values in .env are never changed. Blank ones get local defaults: a SQLite file for the
// database and a random auth secret.
import { randomBytes } from "node:crypto";

import {
  deleteLocalDatabase,
  migrateDatabase,
  requireLocalDatabase,
} from "./local-db";

const ENV_FILE = ".env";
const ASSIGNMENT = /^([A-Z0-9_]+)=(.*)$/;
const QUOTED = /^(["'])(.*)\1$/;

const defaults: Record<string, () => string> = {
  TURSO_DATABASE_URL: () => "file:local.db",
  BETTER_AUTH_SECRET: () => randomBytes(32).toString("base64"),
};

const features = [
  {
    name: "spoken audio for words and sentences",
    keys: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"],
  },
  { name: "generated audio cache", keys: ["BLOB_READ_WRITE_TOKEN"] },
  {
    name: "daily review reminders",
    keys: [
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "VAPID_SUBJECT",
      "CRON_SECRET",
    ],
  },
];

const unquote = (value: string) => value.trim().replace(QUOTED, "$2");

const existing = Bun.file(ENV_FILE);
const created = !(await existing.exists());
const lines = (
  await (created ? Bun.file(".env.example") : existing).text()
).split("\n");

const values = new Map<string, string>();
const filled: string[] = [];
const output = lines.map((line) => {
  const match = ASSIGNMENT.exec(line);
  if (!match) {
    return line;
  }
  const [, key, raw] = match;
  const value = unquote(raw);
  if (value || !defaults[key]) {
    values.set(key, value);
    return line;
  }
  const generated = defaults[key]();
  values.set(key, generated);
  filled.push(key);
  return `${key}=${generated}`;
});
// An older .env may predate a variable; add the ones setup knows how to fill.
for (const [key, make] of Object.entries(defaults)) {
  if (!values.has(key)) {
    const value = make();
    values.set(key, value);
    filled.push(key);
    output.push(`${key}=${value}`);
  }
}

if (created || filled.length) {
  await Bun.write(ENV_FILE, output.join("\n"));
}
if (created) {
  const filling = filled.length ? `, filling ${filled.join(", ")}` : "";
  console.log(`Created .env from .env.example${filling}.`);
} else if (filled.length) {
  console.log(`Filled ${filled.join(", ")} in .env.`);
} else {
  console.log(".env is complete.");
}

// Bun loaded the old .env when this script started; use what was just written.
for (const [key, value] of values) {
  process.env[key] = value;
}

if (process.argv.includes("--reset")) {
  const file = requireLocalDatabase("reset the database");
  await deleteLocalDatabase(file);
  console.log(`Deleted ${file}.`);
}
await migrateDatabase();
console.log(`Database ready at ${values.get("TURSO_DATABASE_URL")}.`);

console.log("\nOptional features:");
for (const feature of features) {
  const missing = feature.keys.filter((key) => !values.get(key));
  console.log(
    missing.length
      ? `  off  ${feature.name} (set ${missing.join(", ")})`
      : `  on   ${feature.name}`
  );
}

console.log(
  "\nNext: `bun run dev`, then open http://localhost:3000. `bun run db:seed` adds a demo account with two weeks of progress."
);
