import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/outbound_os";

// Single connection per process. Locally this is plenty; on serverless the
// transaction pooler (prepare:false) is what keeps this safe.
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

const sqlClient = globalForDb.__sql ?? postgres(connectionString, {
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idle_timeout: 20,
  prepare: false,
  onnotice: () => {},
});

if (process.env.NODE_ENV !== "production") globalForDb.__sql = sqlClient;

export const db = drizzle(sqlClient, { schema });
export { sqlClient };
export type DB = typeof db;
