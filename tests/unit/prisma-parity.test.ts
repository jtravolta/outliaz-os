import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

import { createPrismaClient } from "../../lib/db/prisma";

test("Prisma reads the same core row counts as PostgreSQL", async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "DATABASE_URL must be configured");

  const sql = postgres(connectionString, { max: 1, prepare: false });
  const prisma = createPrismaClient(connectionString);

  try {
    const [expected] = await sql<
      [{ workspaces: number; users: number; prospects: number }]
    >`
      select
        (select count(*)::int from workspaces) as workspaces,
        (select count(*)::int from users) as users,
        (select count(*)::int from prospects) as prospects
    `;

    const [workspaces, users, prospects] = await Promise.all([
      prisma.workspaces.count(),
      prisma.users.count(),
      prisma.prospects.count(),
    ]);

    assert.deepEqual(
      { workspaces, users, prospects },
      expected,
      "Prisma must preserve access to existing rows",
    );
  } finally {
    await prisma.$disconnect();
    await sql.end();
  }
});
