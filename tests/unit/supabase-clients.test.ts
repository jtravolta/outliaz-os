import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import { createServerSupabaseClient } from "../../lib/supabase/server";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function restoreEnvironment() {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
}

test("browser client requires the public Supabase URL and publishable key", () => {
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.throws(() => createBrowserSupabaseClient(), /NEXT_PUBLIC_SUPABASE_URL/);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    assert.throws(
      () => createBrowserSupabaseClient(),
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  } finally {
    restoreEnvironment();
  }
});

test("server client forwards refreshed cookie writes and options to the request store", async () => {
  const reads: string[] = [];
  const writes: Array<{ name: string; value: string; options: object }> = [];
  const cookieStore = {
    getAll() {
      reads.push("getAll");
      return [];
    },
    set(name: string, value: string, options?: object) {
      assert.ok(options);
      writes.push({ name, value, options });
    },
  };

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ user: { id: "user-id", aud: "authenticated", role: "authenticated" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  try {
    const client = await createServerSupabaseClient(cookieStore);
    assert.ok(client.auth);
    const payload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    const result = await client.auth.setSession({
      access_token: `eyJhbGciOiJub25lIn0.${payload}.sig1`,
      refresh_token: "refresh-token",
    });
    assert.equal(result.error, null);
    assert.ok(reads.length > 0);
    assert.ok(writes.length > 0);
    assert.ok(writes.every(({ name, value, options }) =>
      name.length > 0 && value.length > 0 && "path" in options && options.path === "/"));
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});
