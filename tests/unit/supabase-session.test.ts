import assert from "node:assert/strict";
import test from "node:test";

import {
  getSupabaseSessionUser,
  type SessionUser,
} from "../../lib/auth/session";

type Claims = Record<string, unknown>;

function fakeDependencies(options: {
  claims?: Claims | null;
  claimError?: Error | null;
  row?: Record<string, unknown> | null;
}) {
  const lookup = { users: { findUnique: async () => options.row ?? null } };
  const supabase = {
    auth: {
      getClaims: async () => ({
        data: options.claims ? { claims: options.claims } : null,
        error: options.claimError ?? null,
      }),
    },
  };
  return { lookup, supabase };
}

const activeRow = {
  id: "auth-user-1",
  workspace_id: "workspace-1",
  email: "owner@example.test",
  name: "Owner",
  role: "OWNER",
  status: "ACTIVE",
  workspaces: { name: "Acme" },
} as const;

test("maps verified active Auth claims to the application SessionUser", async () => {
  const { lookup, supabase } = fakeDependencies({
    claims: { sub: activeRow.id, email: "untrusted@example.test" },
    row: activeRow,
  });

  assert.deepEqual(
    await getSupabaseSessionUser(supabase, lookup),
    {
      userId: activeRow.id,
      workspaceId: activeRow.workspace_id,
      email: activeRow.email,
      name: activeRow.name,
      role: activeRow.role,
      workspaceName: activeRow.workspaces.name,
    } satisfies SessionUser,
  );
});

test("rejects absent, malformed, or unverifiable claims", async () => {
  for (const claims of [null, {}, { sub: 42 }]) {
    const { lookup, supabase } = fakeDependencies({ claims });
    assert.equal(await getSupabaseSessionUser(supabase, lookup), null);
  }

  const { lookup, supabase } = fakeDependencies({
    claims: { sub: activeRow.id },
    claimError: new Error("invalid token"),
  });
  assert.equal(await getSupabaseSessionUser(supabase, lookup), null);
});

test("rejects an Auth identity with no application-user mapping", async () => {
  const { lookup, supabase } = fakeDependencies({
    claims: { sub: "unmapped-user" },
  });

  assert.equal(await getSupabaseSessionUser(supabase, lookup), null);
});

test("rejects disabled application users and uses database role/workspace values", async () => {
  const { lookup, supabase } = fakeDependencies({
    claims: { sub: activeRow.id, role: "OWNER", user_metadata: { role: "OWNER" } },
    row: { ...activeRow, status: "DISABLED", role: "MEMBER", workspaces: { name: "Actual workspace" } },
  });

  assert.equal(await getSupabaseSessionUser(supabase, lookup), null);
});
