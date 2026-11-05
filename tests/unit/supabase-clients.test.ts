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

test("server client uses the supplied request cookie adapter", async () => {
  const reads: string[] = [];
  const cookieStore = {
    getAll() {
      reads.push("getAll");
      return [{ name: "sb-example-auth-token", value: "not-a-session" }];
    },
    setAll() {
      reads.push("setAll");
    },
  };

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";
  try {
    const client = await createServerSupabaseClient(cookieStore);
    assert.ok(client.auth);
    await client.auth.getSession();
    assert.ok(reads.length > 0);
    assert.ok(reads.every((operation) => operation === "getAll"));
  } finally {
    restoreEnvironment();
  }
});
