import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { createPrismaClient } from "../../lib/db/prisma";
import { getWorkspace, listIntegrations } from "../../lib/services/settings";

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

test("listIntegrations reads credentials only from the scoped Prisma workspace", async () => {
  const sourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  assert.ok(sourceUrl, "DIRECT_URL or DATABASE_URL must be configured");

  const testUrl = new URL(sourceUrl);
  testUrl.pathname = "/outbound_os_prisma_test";
  const prisma = createPrismaClient(testUrl.toString());
  const workspaceId = randomUUID();

  await prisma.workspaces.create({
    data: { id: workspaceId, name: "Prisma integration test" },
  });
  await prisma.integration_credentials.create({
    data: {
      workspace_id: workspaceId,
      kind: "APIFY",
      label: "isolated-prisma-credential",
      config: { actor: "test" },
      secret_ciphertext: "encrypted-test-value",
    },
  });

  try {
    const integrations = await listIntegrations(
      {
        user: {
          userId: randomUUID(),
          workspaceId,
          email: "test@example.com",
          name: "Test",
          role: "OWNER",
          workspaceName: "Prisma integration test",
        },
      },
      prisma,
    );

    const apify = integrations.find(({ kind }) => kind === "APIFY");
    assert.equal(apify?.configured, true);
    assert.equal(apify?.label, "isolated-prisma-credential");
  } finally {
    await prisma.workspaces.delete({ where: { id: workspaceId } });
    await prisma.$disconnect();
  }
});
