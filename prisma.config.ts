import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Schema tooling must use a direct/session connection, never PgBouncer
    // transaction mode. Runtime uses DATABASE_URL separately.
    url: env("DIRECT_URL"),
  },
});
