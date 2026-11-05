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
    if (scenario.url.includes("code=")) assert.equal(signedOut, 1);
  }
});
