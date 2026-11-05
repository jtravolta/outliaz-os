import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const testUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/outbound_os_supabase_test";

process.env.DATABASE_URL = testUrl;

test("dashboard tolerates the authoritative schema having no notifications table", async () => {
  const { dashboard } = await import("../../lib/services/analytics");
  const { sqlClient } = await import("../../lib/db/client");

  try {
    const result = await dashboard({
      user: {
        userId: randomUUID(),
        workspaceId: randomUUID(),
        email: "owner@example.test",
        name: "Owner",
        role: "OWNER",
        workspaceName: "Outliaz",
      },
    });

    assert.deepEqual(result.notifications, []);
  } finally {
    await sqlClient.end();
  }
});
