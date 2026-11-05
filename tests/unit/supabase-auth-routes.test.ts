import assert from "node:assert/strict";
import test from "node:test";

import { handleCallback, handleSignIn } from "../../lib/auth/magic-link";

const appUser = {
  userId: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  email: "owner@example.test",
  name: "Owner",
  role: "OWNER" as const,
  workspaceName: "Acme",
};

function request(url: string, init?: RequestInit) {
  return new Request(url, init);
}

test("sign-in normalizes email, uses the configured callback, and returns generic success", async () => {
  let received: { email: string; options?: { emailRedirectTo?: string } } | undefined;
  const response = await handleSignIn(
    request("http://localhost/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email: "  OWNER@EXAMPLE.TEST " }),
    }),
    {
      signInWithOtp: async (args) => {
        received = args;
        return { error: null };
      },
      appUrl: "https://app.example.test",
    },
  );

  assert.deepEqual(response, { ok: true });
  assert.deepEqual(received, {
    email: "owner@example.test",
    options: { emailRedirectTo: "https://app.example.test/auth/callback" },
  });
});

test("sign-in keeps provider failures generic", async () => {
  const response = await handleSignIn(
    request("http://localhost/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email: "unknown@example.test" }),
    }),
    {
      signInWithOtp: async () => { throw new Error("provider failure"); },
    },
  );
  assert.deepEqual(response, { ok: true });
});

test("sign-in invokes the Supabase OTP method with its auth receiver", async () => {
  let receiver: unknown;
  const auth = {
    signInWithOtp(this: unknown) {
      receiver = this;
      return Promise.resolve({ error: null });
    },
  };

  await handleSignIn(
    request("http://localhost/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email: "owner@example.test" }),
    }),
    { supabase: { auth } },
  );

  assert.equal(receiver, auth);
});

test("callback exchanges the code and redirects an active mapped user to dashboard", async () => {
  let exchanged = "";
  const response = await handleCallback(
    request("https://app.example.test/auth/callback?code=magic-code"),
    {
      exchangeCodeForSession: async (code) => {
        exchanged = code;
        return { error: null };
      },
      resolveUser: async () => appUser,
      signOut: async () => ({ error: null }),
    },
  );

  assert.equal(exchanged, "magic-code");
  assert.equal(response.headers.get("location"), "https://app.example.test/dashboard");
});

test("callback denies missing code, exchange failures, unmapped users, and disabled users", async () => {
  for (const scenario of [
    { url: "https://app.example.test/auth/callback", exchangeError: false, user: appUser },
    { url: "https://app.example.test/auth/callback?code=bad", exchangeError: true, user: appUser },
    { url: "https://app.example.test/auth/callback?code=unknown", exchangeError: false, user: null },
  ]) {
    let signedOut = 0;
    const response = await handleCallback(request(scenario.url), {
      exchangeCodeForSession: async () => ({ error: scenario.exchangeError ? new Error("bad code") : null }),
      resolveUser: async () => scenario.user,
      signOut: async () => { signedOut += 1; return { error: null }; },
    });
    assert.equal(response.headers.get("location"), "https://app.example.test/login?error=access_denied");
    assert.equal(signedOut, 1);
  }
});

test("callback preserves the denial redirect when session cleanup throws", async () => {
  const response = await handleCallback(request("https://app.example.test/auth/callback"), {
    exchangeCodeForSession: async () => ({ error: null }),
    resolveUser: async () => null,
    signOut: async () => { throw new Error("cleanup failed"); },
  });

  assert.equal(response.headers.get("location"), "https://app.example.test/login?error=access_denied");
});

test("callback preserves the denial redirect when SSR client construction throws", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  try {
    const response = await handleCallback(request("https://app.example.test/auth/callback"));
    assert.equal(response.headers.get("location"), "https://app.example.test/login?error=access_denied");
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});
