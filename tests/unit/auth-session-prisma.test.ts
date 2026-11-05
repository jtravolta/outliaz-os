import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { signInWithEmail } from "../../lib/auth/session";
import { createPrismaClient } from "../../lib/db/prisma";

test("signInWithEmail normalizes email, joins the workspace, and rejects disabled users", async () => {
  const testUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/outbound_os_supabase_test";
  const prisma = createPrismaClient(testUrl);
  const activeWorkspaceId = randomUUID();
  const disabledWorkspaceId = randomUUID();
  const activeUserId = randomUUID();
  const previousAllowedEmails = process.env.ALLOWED_EMAILS;
  const previousMockProviders = process.env.MOCK_PROVIDERS;

  process.env.ALLOWED_EMAILS = "owner@example.test, disabled@example.test";
  process.env.MOCK_PROVIDERS = "false";

  await prisma.$transaction(async (tx) => {
    await tx.workspaces.createMany({
      data: [
        { id: activeWorkspaceId, name: "Active workspace" },
        { id: disabledWorkspaceId, name: "Disabled workspace" },
      ],
    });
    await tx.users.createMany({
      data: [
        {
          id: activeUserId,
          workspace_id: activeWorkspaceId,
          email: "owner@example.test",
          name: "Active Owner",
          role: "OWNER",
          status: "ACTIVE",
        },
        {
          id: randomUUID(),
          workspace_id: disabledWorkspaceId,
          email: "workspace-owner@example.test",
          name: "Workspace Owner",
          role: "OWNER",
          status: "ACTIVE",
        },
        {
          id: randomUUID(),
          workspace_id: disabledWorkspaceId,
          email: "disabled@example.test",
          name: "Disabled Admin",
          role: "ADMIN",
          status: "DISABLED",
        },
      ],
    });
  });

  try {
    assert.deepEqual(await signInWithEmail("  OWNER@EXAMPLE.TEST  ", prisma), {
      userId: activeUserId,
      workspaceId: activeWorkspaceId,
      email: "owner@example.test",
      name: "Active Owner",
      role: "OWNER",
      workspaceName: "Active workspace",
    });
    assert.equal(await signInWithEmail("disabled@example.test", prisma), null);
  } finally {
    if (previousAllowedEmails === undefined) delete process.env.ALLOWED_EMAILS;
    else process.env.ALLOWED_EMAILS = previousAllowedEmails;
    if (previousMockProviders === undefined) delete process.env.MOCK_PROVIDERS;
    else process.env.MOCK_PROVIDERS = previousMockProviders;

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
