import assert from "node:assert/strict";
import test from "node:test";

import {
  getSupabaseSessionUser,
  requireSession,
  signInWithEmail,
  type SessionUser,
} from "../../lib/auth/session";

type Claims = Record<string, unknown>;

function fakeDependencies(options: {
  claims?: Claims | null;
  claimError?: Error | null;
  row?: Record<string, unknown> | null;
  claimsError?: Error;
  databaseError?: Error;
}) {
  const lookup = {
    users: {
      findUnique: async () => {
        if (options.databaseError) throw options.databaseError;
        return options.row ?? null;
      },
    },
  };
  const supabase = {
    auth: {
      getClaims: async () => {
        if (options.claimsError) throw options.claimsError;
        return {
          data: options.claims ? { claims: options.claims } : null,
          error: options.claimError ?? null,
        };
      },
    },
  };
  return { lookup, supabase };
}

const activeRow = {
  id: "11111111-1111-4111-8111-111111111111",
  workspace_id: "22222222-2222-4222-8222-222222222222",
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
    claims: { sub: "33333333-3333-4333-8333-333333333333" },
  });

  assert.equal(await getSupabaseSessionUser(supabase, lookup), null);
});

test("rejects a malformed string subject before database lookup", async () => {
  let lookupCount = 0;
  const { supabase } = fakeDependencies({ claims: { sub: "not-a-uuid" } });
  const lookup = {
    users: { findUnique: async () => { lookupCount += 1; return activeRow; } },
  };

  assert.equal(await getSupabaseSessionUser(supabase, lookup), null);
  assert.equal(lookupCount, 0);
});

test("fails closed when Auth claims or the database resolver throws", async () => {
  const authFailure = fakeDependencies({
    claimsError: new Error("claims unavailable"),
  });
  assert.equal(await getSupabaseSessionUser(authFailure.supabase, authFailure.lookup), null);

  const databaseFailure = fakeDependencies({
    claims: { sub: activeRow.id },
    databaseError: new Error("database unavailable"),
  });
  assert.equal(await getSupabaseSessionUser(databaseFailure.supabase, databaseFailure.lookup), null);
});

test("requireSession converts an unresolved session to UNAUTHORIZED", async () => {
  const { lookup, supabase } = fakeDependencies({ claims: null });
  await assert.rejects(
    requireSession(supabase, lookup),
    (error: Error) => error.message === "UNAUTHORIZED",
  );
});

test("rejects disabled application users and uses database role/workspace values", async () => {
  const { lookup, supabase } = fakeDependencies({
    claims: { sub: activeRow.id, role: "OWNER", user_metadata: { role: "OWNER" } },
    row: { ...activeRow, status: "DISABLED", role: "MEMBER", workspaces: { name: "Actual workspace" } },
  });

  assert.equal(await getSupabaseSessionUser(supabase, lookup), null);
});

test("legacy email sign-in is unavailable after the Supabase cutover", async () => {
  const previousCutover = process.env.SUPABASE_AUTH_CUTOVER;
  let lookupCount = 0;
  process.env.SUPABASE_AUTH_CUTOVER = "true";

  try {
    const prisma = {
      users: {
        findUnique: async () => {
          lookupCount += 1;
          return null;
        },
      },
    } as never;

    assert.equal(await signInWithEmail("owner@example.test", prisma), null);
    assert.equal(lookupCount, 0);
  } finally {
    if (previousCutover === undefined) delete process.env.SUPABASE_AUTH_CUTOVER;
    else process.env.SUPABASE_AUTH_CUTOVER = previousCutover;
  }
});
