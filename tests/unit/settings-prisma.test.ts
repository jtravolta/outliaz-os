import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { createPrismaClient } from "../../lib/db/prisma";
import { getWorkspace, listIntegrations } from "../../lib/services/settings";

test("getWorkspace uses its Prisma client and keeps workspace scope", async () => {
  const testUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/outbound_os_supabase_test";
  const prisma = createPrismaClient(testUrl);

  try {
    await assert.rejects(
      getWorkspace(
        {
          user: {
            userId: "00000000-0000-0000-0000-000000000000",
            workspaceId: randomUUID(),
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
  const testUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/outbound_os_supabase_test";
  const prisma = createPrismaClient(testUrl);
  const workspaceId = randomUUID();
  const ownerId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.workspaces.create({
      data: { id: workspaceId, name: "Prisma integration test" },
    });
    await tx.users.create({
      data: {
        id: ownerId,
        workspace_id: workspaceId,
        email: `${ownerId}@example.test`,
        name: "Test owner",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    await tx.integration_credentials.create({
      data: {
        workspace_id: workspaceId,
        kind: "APIFY",
        label: "isolated-prisma-credential",
        config: { actor: "test" },
        secret_ciphertext: Buffer.from("encrypted-test-value"),
        secret_iv: Buffer.alloc(12),
        secret_tag: Buffer.alloc(16),
      },
    });
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
    await prisma.$disconnect();
    const cleanup = postgres(testUrl, {
      max: 1,
      prepare: false,
      onnotice: () => {},
    });
    try {
      await cleanup`truncate table workspaces cascade`;
    } finally {
      await cleanup.end();
    }
  }
});
