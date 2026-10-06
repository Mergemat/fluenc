import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getTursoCredentials } from "./config";
import { schema } from "./schema";

const client = createClient(getTursoCredentials());

export const db = drizzle(client, { schema });
