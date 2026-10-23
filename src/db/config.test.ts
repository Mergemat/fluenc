import { afterEach, expect, test } from "bun:test";

import { getTursoCredentials } from "./config";

const previous = {
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
};
afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

const use = (url: string, token: string) => {
  process.env.TURSO_DATABASE_URL = url;
  process.env.TURSO_AUTH_TOKEN = token;
};

test("a local file database opens without a token", () => {
  use("file:local.db", "");
  expect(getTursoCredentials()).toEqual({
    url: "file:local.db",
    authToken: undefined,
  });
});

test("a remote database without a token fails before connecting", () => {
  use("libsql://fluenc.turso.io", " ");
  expect(getTursoCredentials).toThrow("TURSO_AUTH_TOKEN is required");
});

test("a missing database points at setup", () => {
  use("", "token");
  expect(getTursoCredentials).toThrow("bun run setup");
});
