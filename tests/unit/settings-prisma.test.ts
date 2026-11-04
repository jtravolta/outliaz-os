import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

import { createPrismaClient } from "../../lib/db/prisma";
import { getWorkspace } from "../../lib/services/settings";

test("getWorkspace uses its Prisma client and keeps workspace scope", async () => {
  const sourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  assert.ok(sourceUrl, "DIRECT_URL or DATABASE_URL must be configured");

  const source = postgres(sourceUrl, { max: 1, prepare: false });
  const [workspace] = await source<{ id: string }[]>`
    select id from workspaces order by created_at limit 1
  `;
  await source.end();
  assert.ok(workspace, "source database must contain a workspace");

  const testUrl = new URL(sourceUrl);
  testUrl.pathname = "/outbound_os_prisma_test";
  const prisma = createPrismaClient(testUrl.toString());

  try {
    await assert.rejects(
      getWorkspace(
        {
          user: {
            userId: "00000000-0000-0000-0000-000000000000",
            workspaceId: workspace.id,
            email: "test@example.com",
            name: "Test",
            role: "OWNER",
            workspaceName: "Test",
          },
        },
        prisma,
      ),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "NOT_FOUND",
    );
  } finally {
    await prisma.$disconnect();
  }
});
