import "dotenv/config";
import { defineConfig } from "drizzle-kit";

import { getTursoCredentials } from "./src/db/config";

export default defineConfig({
  out: "./drizzle",
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  dialect: "turso",
  dbCredentials: getTursoCredentials(),
});
